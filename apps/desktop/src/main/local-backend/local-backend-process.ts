import type { UtilityProcess } from "electron";
import { utilityProcess } from "electron";
import type { AiProviderSelection } from "@careerden/infrastructure";
import {
  parseLocalBackendEvent,
  type LocalBackendCommand,
  type LocalBackendEvent,
} from "./local-backend-messages.js";
import { LocalBackendStartError } from "../startup-recovery/startup-failure.js";

type LocalBackendChild = Pick<UtilityProcess, "kill" | "on" | "postMessage">;
type LocalBackendNotice = LocalBackendEvent | { type: "exit"; code: number };

export type LocalBackendFork = (
  modulePath: string,
  args?: string[],
  options?: Parameters<typeof utilityProcess.fork>[2],
) => LocalBackendChild;

export interface LocalBackendProcessOptions {
  modulePath: string;
  dataDir: string;
  sessionToken: string;
  appVersion: string;
  backupsDir: string;
  logFile: string;
  // 0 picks a free loopback port.
  port?: number;
  renderPdf: (html: string) => Promise<Buffer>;
  getAiSelection: () => Promise<AiProviderSelection | null>;
  // Only after the backend was ready. An exit during start rejects start() instead, so a failure
  // that repeats on every launch never turns into a restart loop.
  onUnexpectedExit?: (code: number) => void;
  fork?: LocalBackendFork;
  startTimeoutMs?: number;
  stopTimeoutMs?: number;
}

// Owns the utility process that runs the local edition's API and background work.
export class LocalBackendProcess {
  private child: LocalBackendChild | undefined;
  private stopping = false;
  private ready = false;
  private readonly waiters = new Set<(event: LocalBackendNotice) => void>();

  constructor(private readonly options: LocalBackendProcessOptions) {}

  // Rejects with a LocalBackendStartError that says why the backend could not start.
  async start(): Promise<{ baseUrl: string; lastMigration?: string }> {
    if (this.child) throw new Error("The local backend is already running");

    const fork = this.options.fork ?? utilityProcess.fork;
    const child = fork(this.options.modulePath, [], { serviceName: "careerden-local-backend" });
    this.child = child;
    this.stopping = false;
    this.ready = false;

    child.on("message", (message: unknown) => this.handleMessage(child, message));
    child.on("exit", (code: number) => {
      if (this.child !== child) return;
      this.child = undefined;
      this.notify({ type: "exit", code });
      if (!this.stopping && this.ready) this.options.onUnexpectedExit?.(code);
    });

    const result = this.waitFor(
      (event) =>
        event.type === "ready" ||
        event.type === "start:error" ||
        event.type === "start:data-error" ||
        event.type === "exit",
      this.options.startTimeoutMs ?? 60_000,
    );
    this.send({
      type: "start",
      dataDir: this.options.dataDir,
      sessionToken: this.options.sessionToken,
      port: this.options.port ?? 0,
      appVersion: this.options.appVersion,
      backupsDir: this.options.backupsDir,
      logFile: this.options.logFile,
    });

    const event = await result.catch((error: unknown) => {
      this.kill();
      throw new LocalBackendStartError({
        reason: "start-failed",
        message: error instanceof Error ? error.message : String(error),
      });
    });
    if (event.type === "ready") {
      this.ready = true;
      return {
        baseUrl: `http://127.0.0.1:${event.port}`,
        ...(event.lastMigration ? { lastMigration: event.lastMigration } : {}),
      };
    }

    this.kill();
    if (event.type === "start:data-error") throw new LocalBackendStartError(event.failure);
    throw new LocalBackendStartError({
      reason: "start-failed",
      message:
        event.type === "start:error"
          ? event.message
          : event.type === "exit"
            ? `The local backend exited before it was ready (code ${event.code})`
            : "The local backend exited before it was ready",
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.stopping = true;
    const stopped = this.waitFor(
      (event) => event.type === "stopped" || event.type === "exit",
      this.options.stopTimeoutMs ?? 10_000,
    );
    this.send({ type: "stop" });
    await stopped.catch(() => undefined);
    this.kill();
  }

  private handleMessage(child: LocalBackendChild, message: unknown): void {
    const event = parseLocalBackendEvent(message);
    if (!event) return;

    if (event.type === "pdf:request") {
      void this.options.renderPdf(event.html).then(
        (pdf) => this.reply(child, { type: "pdf:result", requestId: event.requestId, pdf }),
        (error: unknown) =>
          this.reply(child, {
            type: "pdf:error",
            requestId: event.requestId,
            message: error instanceof Error ? error.message : "PDF rendering failed",
          }),
      );
      return;
    }

    if (event.type === "ai-selection:request") {
      void this.options.getAiSelection().then(
        (selection) =>
          this.reply(child, { type: "ai-selection:result", requestId: event.requestId, selection }),
        () =>
          this.reply(child, {
            type: "ai-selection:result",
            requestId: event.requestId,
            selection: null,
          }),
      );
      return;
    }

    this.notify(event);
  }

  private waitFor(
    matches: (event: LocalBackendNotice) => boolean,
    timeoutMs: number,
  ): Promise<LocalBackendNotice> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`The local backend did not respond within ${timeoutMs}ms`));
      }, timeoutMs);
      const waiter = (event: LocalBackendNotice) => {
        if (!matches(event)) return;
        clearTimeout(timeout);
        this.waiters.delete(waiter);
        resolve(event);
      };
      this.waiters.add(waiter);
    });
  }

  private notify(event: LocalBackendNotice): void {
    for (const waiter of [...this.waiters]) waiter(event);
  }

  private reply(child: LocalBackendChild, command: LocalBackendCommand): void {
    if (this.child === child) child.postMessage(command);
  }

  private send(command: LocalBackendCommand): void {
    this.child?.postMessage(command);
  }

  private kill(): void {
    const child = this.child;
    this.child = undefined;
    child?.kill();
  }
}

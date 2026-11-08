import { randomUUID } from "node:crypto";
import type { UtilityProcess } from "electron";
import { utilityProcess } from "electron";
import type { AiProviderSelection } from "@careerden/infrastructure";
import type { StructuredLogger } from "@careerden/infrastructure/logging";
import { describeErrorForLog } from "@careerden/infrastructure/logging";
import {
  parseLocalBackendEvent,
  type LocalBackendCommand,
  type LocalBackendEvent,
  type LocalBackupSummary,
  type LocalDatabaseDiagnostics,
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
  // 0 picks a free loopback port.
  port?: number;
  renderPdf: (html: string) => Promise<Buffer>;
  getAiSelection: () => Promise<AiProviderSelection | null>;
  // Only after the backend was ready. An exit during start rejects start() instead, so a failure
  // that repeats on every launch never turns into a restart loop.
  onUnexpectedExit?: (code: number) => void;
  // Lifecycle events observed by the main process.
  log?: StructuredLogger;
  // Entries the utility process posts about its own work.
  childLog?: StructuredLogger;
  fork?: LocalBackendFork;
  startTimeoutMs?: number;
  // How long a shutdown may take before the process is killed.
  stopTimeoutMs?: number;
  backupTimeoutMs?: number;
  diagnosticsTimeoutMs?: number;
  // How long to wait for the exit after the backend reports a completed shutdown.
  exitTimeoutMs?: number;
}

interface PendingBackup {
  resolve: (summary: LocalBackupSummary) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// Owns the utility process that runs the local edition's API and background work.
export class LocalBackendProcess {
  private child: LocalBackendChild | undefined;
  private stopping = false;
  private ready = false;
  private stopped: Promise<void> | undefined;
  private readonly waiters = new Set<(event: LocalBackendNotice) => void>();
  private readonly pendingBackups = new Map<string, PendingBackup>();
  private readonly pendingDiagnostics = new Map<
    string,
    (database: LocalDatabaseDiagnostics | undefined) => void
  >();

  constructor(private readonly options: LocalBackendProcessOptions) {}

  // Rejects with a LocalBackendStartError that says why the backend could not start.
  async start(): Promise<{ baseUrl: string; lastMigration?: string }> {
    if (this.child) throw new Error("The local backend is already running");

    const startedAt = Date.now();
    this.log({ level: "info", event: "local_backend.starting" });
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
      const expected = this.stopping || !this.ready;
      this.log({
        level: this.stopping ? "info" : "error",
        event: expected ? "local_backend.exited" : "local_backend.unexpected_exit",
        fields: { exitCode: code },
      });
      this.failPendingBackups();
      for (const settle of [...this.pendingDiagnostics.values()]) settle(undefined);
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
    });

    const event = await result.catch((error: unknown) => {
      this.log({
        level: "error",
        event: "local_backend.start_failed",
        fields: describeErrorForLog(error),
      });
      this.kill();
      throw new LocalBackendStartError({
        reason: "start-failed",
        message: error instanceof Error ? error.message : String(error),
      });
    });
    if (event.type === "ready") {
      this.ready = true;
      this.log({
        level: "info",
        event: "local_backend.ready",
        fields: { durationMs: Date.now() - startedAt },
      });
      return {
        baseUrl: `http://127.0.0.1:${event.port}`,
        ...(event.lastMigration ? { lastMigration: event.lastMigration } : {}),
      };
    }

    this.kill();
    const failure =
      event.type === "start:data-error"
        ? new LocalBackendStartError(event.failure)
        : new LocalBackendStartError({
            reason: "start-failed",
            message:
              event.type === "start:error"
                ? event.message
                : event.type === "exit"
                  ? `The local backend exited before it was ready (code ${event.code})`
                  : "The local backend exited before it was ready",
          });
    this.log({
      level: "error",
      event: "local_backend.start_failed",
      fields: { reason: failure.failure.reason, ...describeErrorForLog(failure) },
    });
    throw failure;
  }

  // Asks the backend to finish its work, close the database, and exit on its own, which it does
  // with code 0. Killing it is the fallback when it does not within the timeout. Exits from here
  // on are never reported as unexpected.
  stop(): Promise<void> {
    if (!this.child) return Promise.resolve();
    this.stopped ??= this.shutDown().finally(() => {
      this.stopped = undefined;
    });
    return this.stopped;
  }

  private async shutDown(): Promise<void> {
    this.stopping = true;
    this.log({ level: "info", event: "local_backend.stopping" });
    const completed = this.waitFor(
      (event) => event.type === "shutdown:complete" || event.type === "exit",
      this.options.stopTimeoutMs ?? 5_000,
    );
    this.send({ type: "shutdown" });
    const event = await completed.catch(() => undefined);
    if (event?.type === "shutdown:complete" && this.child) {
      await this.waitFor(
        (notice) => notice.type === "exit",
        this.options.exitTimeoutMs ?? 1_000,
      ).catch(() => undefined);
    }
    this.kill();
    this.failPendingBackups();
  }

  // Writes a backup zip of the local data to `outputPath`.
  exportBackup(outputPath: string, appVersion: string): Promise<LocalBackupSummary> {
    return this.requestBackup((requestId) => ({
      type: "backup:export",
      requestId,
      outputPath,
      appVersion,
    }));
  }

  // Replaces the local data with a backup after exporting the current data to `snapshotPath`.
  importBackup(
    archivePath: string,
    snapshotPath: string,
    appVersion: string,
  ): Promise<LocalBackupSummary> {
    return this.requestBackup((requestId) => ({
      type: "backup:import",
      requestId,
      archivePath,
      snapshotPath,
      appVersion,
    }));
  }

  // The engine version and newest migration, or undefined when the backend is not running or does
  // not answer in time. Never rejects, so a diagnostics summary can always be copied.
  describeDatabase(): Promise<LocalDatabaseDiagnostics | undefined> {
    if (!this.child || !this.ready) return Promise.resolve(undefined);
    const requestId = randomUUID();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingDiagnostics.delete(requestId);
        resolve(undefined);
      }, this.options.diagnosticsTimeoutMs ?? 5_000);
      this.pendingDiagnostics.set(requestId, (database) => {
        clearTimeout(timeout);
        this.pendingDiagnostics.delete(requestId);
        resolve(database);
      });
      this.send({ type: "diagnostics:request", requestId });
    });
  }

  private requestBackup(
    command: (requestId: string) => LocalBackendCommand,
  ): Promise<LocalBackupSummary> {
    if (!this.child) return Promise.reject(new Error("The local backend is not running"));
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.pendingBackups.delete(requestId);
          reject(new Error("The backup did not finish in time."));
        },
        this.options.backupTimeoutMs ?? 30 * 60_000,
      );
      this.pendingBackups.set(requestId, { resolve, reject, timeout });
      this.send(command(requestId));
    });
  }

  private settleBackup(
    requestId: string,
    outcome: { summary: LocalBackupSummary } | { error: Error },
  ): void {
    const pending = this.pendingBackups.get(requestId);
    if (!pending) return;
    this.pendingBackups.delete(requestId);
    clearTimeout(pending.timeout);
    if ("error" in outcome) pending.reject(outcome.error);
    else pending.resolve(outcome.summary);
  }

  private failPendingBackups(): void {
    for (const requestId of [...this.pendingBackups.keys()]) {
      this.settleBackup(requestId, {
        error: new Error("The local data service stopped before the backup finished."),
      });
    }
  }

  private handleMessage(child: LocalBackendChild, message: unknown): void {
    const event = parseLocalBackendEvent(message);
    if (!event) return;

    if (event.type === "log") {
      this.options.childLog?.(event.entry);
      return;
    }

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

    if (event.type === "backup:result") {
      this.settleBackup(event.requestId, { summary: event.summary });
      return;
    }

    if (event.type === "backup:error") {
      this.settleBackup(event.requestId, { error: new Error(event.message) });
      return;
    }

    if (event.type === "diagnostics:result") {
      this.pendingDiagnostics.get(event.requestId)?.(event.database);
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

  private log(entry: Parameters<StructuredLogger>[0]): void {
    this.options.log?.(entry);
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

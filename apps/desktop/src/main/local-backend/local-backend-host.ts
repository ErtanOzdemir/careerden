import { randomUUID } from "node:crypto";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DocumentRenderer } from "@careerden/domain";
import type { AiProviderSelection, AiProviderSelectionSource } from "@careerden/infrastructure";
import { createLocalBackendLog } from "./local-backend-log.js";
import {
  parseLocalBackendCommand,
  type LocalBackendCommand,
  type LocalBackendEvent,
  type LocalDataStartupFailure,
} from "./local-backend-messages.js";

export interface LocalBackendParentPort {
  on(event: "message", listener: (message: unknown) => void): unknown;
  postMessage(message: LocalBackendEvent): void;
}

export interface LocalBackendRuntime {
  app: RequestListener;
  lastMigration?: string | undefined;
  close(): Promise<void>;
}

export type CreateLocalBackendRuntime = (options: {
  dataDir: string;
  sessionToken: string;
  pdfRenderer: DocumentRenderer;
  aiProviderSelection: AiProviderSelectionSource;
  dataSnapshots: { appVersion: string; backupsDir: string; log: (message: string) => void };
}) => Promise<LocalBackendRuntime>;

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// Runs inside the local backend utility process. Serves the local API on loopback only and asks
// the main process for what only it can provide: Chromium PDF printing and the decrypted AI key.
export function startLocalBackendHost(
  parentPort: LocalBackendParentPort,
  createRuntime: CreateLocalBackendRuntime,
  options: {
    pdfTimeoutMs?: number;
    aiSelectionTimeoutMs?: number;
    // Recognizes errors that mean the local data cannot be opened, which retrying will not fix.
    describeStartupError?: (error: unknown) => LocalDataStartupFailure | undefined;
  } = {},
): void {
  const pendingPdfs = new Map<string, PendingRequest<Buffer>>();
  const pendingSelections = new Map<string, PendingRequest<AiProviderSelection | null>>();
  let runtime: LocalBackendRuntime | undefined;
  let server: Server | undefined;

  function request<T>(
    pending: Map<string, PendingRequest<T>>,
    timeoutMs: number,
    label: string,
    send: (requestId: string) => LocalBackendEvent,
  ): Promise<T> {
    const requestId = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`The desktop app did not answer the ${label} request in time`));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timeout });
      parentPort.postMessage(send(requestId));
    });
  }

  function settle<T>(
    pending: Map<string, PendingRequest<T>>,
    requestId: string,
    outcome: { value: T } | { error: Error },
  ): void {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    clearTimeout(entry.timeout);
    if ("error" in outcome) entry.reject(outcome.error);
    else entry.resolve(outcome.value);
  }

  async function start(command: Extract<LocalBackendCommand, { type: "start" }>): Promise<void> {
    if (runtime) return;
    try {
      runtime = await createRuntime({
        dataDir: command.dataDir,
        sessionToken: command.sessionToken,
        pdfRenderer: {
          htmlToPdf: (html) =>
            request(pendingPdfs, options.pdfTimeoutMs ?? 120_000, "PDF", (requestId) => ({
              type: "pdf:request",
              requestId,
              html,
            })),
        },
        aiProviderSelection: {
          current: () =>
            request(
              pendingSelections,
              options.aiSelectionTimeoutMs ?? 10_000,
              "AI provider",
              (requestId) => ({ type: "ai-selection:request", requestId }),
            ),
        },
        dataSnapshots: {
          appVersion: command.appVersion,
          backupsDir: command.backupsDir,
          log: createLocalBackendLog(command.logFile),
        },
      });
      const listening = createServer(runtime.app);
      server = listening;
      await new Promise<void>((resolve, reject) => {
        listening.once("error", reject);
        listening.listen(command.port, "127.0.0.1", () => resolve());
      });
      parentPort.postMessage({
        type: "ready",
        port: (listening.address() as AddressInfo).port,
        ...(runtime.lastMigration ? { lastMigration: runtime.lastMigration } : {}),
      });
    } catch (error) {
      const failure = options.describeStartupError?.(error);
      parentPort.postMessage(
        failure
          ? { type: "start:data-error", failure }
          : {
              type: "start:error",
              message: error instanceof Error ? error.message : String(error),
            },
      );
    }
  }

  async function stop(): Promise<void> {
    const current = server;
    server = undefined;
    if (current) {
      // Event streams stay open indefinitely; drop them so close() can finish.
      current.closeAllConnections();
      await new Promise<void>((resolve) => current.close(() => resolve()));
    }
    await runtime?.close();
    runtime = undefined;
    parentPort.postMessage({ type: "stopped" });
  }

  parentPort.on("message", (message) => {
    const command = parseLocalBackendCommand(message);
    if (!command) return;

    switch (command.type) {
      case "start":
        void start(command);
        return;
      case "stop":
        void stop();
        return;
      case "pdf:result":
        settle(pendingPdfs, command.requestId, { value: Buffer.from(command.pdf) });
        return;
      case "pdf:error":
        settle(pendingPdfs, command.requestId, { error: new Error(command.message) });
        return;
      case "ai-selection:result":
        settle(pendingSelections, command.requestId, { value: command.selection });
        return;
    }
  });
}

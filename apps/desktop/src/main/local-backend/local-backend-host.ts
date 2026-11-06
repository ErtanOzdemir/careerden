import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname } from "node:path";
import type { DocumentRenderer } from "@careerden/domain";
import type { AiProviderSelection, AiProviderSelectionSource } from "@careerden/infrastructure";
import {
  parseLocalBackendCommand,
  type LocalBackendCommand,
  type LocalBackendEvent,
  type LocalBackupSummary,
} from "./local-backend-messages.js";

export interface LocalBackendParentPort {
  on(event: "message", listener: (message: unknown) => void): unknown;
  postMessage(message: LocalBackendEvent): void;
}

// The parts of a backup manifest the host reports back.
export interface LocalBackendBackupManifest {
  createdAt: string;
  appVersion: string;
  tables: Array<{ name: string; rows: number }>;
  files: number;
}

export interface LocalBackendRuntime {
  app: RequestListener;
  exportBackup(options: {
    outputPath: string;
    appVersion: string;
  }): Promise<LocalBackendBackupManifest>;
  close(): Promise<void>;
}

export type CreateLocalBackendRuntime = (options: {
  dataDir: string;
  sessionToken: string;
  pdfRenderer: DocumentRenderer;
  aiProviderSelection: AiProviderSelectionSource;
}) => Promise<LocalBackendRuntime>;

// Validates an archive and restores it into `stagingDir`, leaving the live data untouched.
export type PrepareLocalBackupImport = (options: {
  archivePath: string;
  stagingDir: string;
}) => Promise<LocalBackendBackupManifest>;

export interface LocalBackendHostOptions {
  pdfTimeoutMs?: number;
  aiSelectionTimeoutMs?: number;
  prepareImport?: PrepareLocalBackupImport;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// Errors with this name carry a message written for the user; others are reported generically.
const userFacingErrorName = "LocalBackupError";

class LocalBackupHostError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = userFacingErrorName;
  }
}

// Runs inside the local backend utility process. Serves the local API on loopback only and asks
// the main process for what only it can provide: Chromium PDF printing and the decrypted AI key.
// It owns the data directory, so backups are exported and imported here too.
export function startLocalBackendHost(
  parentPort: LocalBackendParentPort,
  createRuntime: CreateLocalBackendRuntime,
  options: LocalBackendHostOptions = {},
): void {
  const pendingPdfs = new Map<string, PendingRequest<Buffer>>();
  const pendingSelections = new Map<string, PendingRequest<AiProviderSelection | null>>();
  let runtime: LocalBackendRuntime | undefined;
  let runtimeOptions: Parameters<CreateLocalBackendRuntime>[0] | undefined;
  let server: Server | undefined;
  // Backups run one at a time, and an import replaces the runtime the next one uses.
  let backupQueue: Promise<unknown> = Promise.resolve();

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
      runtimeOptions = {
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
      };
      runtime = await createRuntime(runtimeOptions);
      // Requests reach whichever runtime is current, so an import can swap it on the same port.
      const listening = createServer((incoming, response) => {
        if (runtime) {
          runtime.app(incoming, response);
          return;
        }
        response.statusCode = 503;
        response.end();
      });
      server = listening;
      await new Promise<void>((resolve, reject) => {
        listening.once("error", reject);
        listening.listen(command.port, "127.0.0.1", () => resolve());
      });
      parentPort.postMessage({
        type: "ready",
        port: (listening.address() as AddressInfo).port,
      });
    } catch (error) {
      parentPort.postMessage({
        type: "start:error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function exportBackup(
    command: Extract<LocalBackendCommand, { type: "backup:export" }>,
  ): Promise<LocalBackupSummary> {
    if (!runtime) throw new LocalBackupHostError("Your local data is not open.");
    await mkdir(dirname(command.outputPath), { recursive: true });
    return summarize(
      await runtime.exportBackup({
        outputPath: command.outputPath,
        appVersion: command.appVersion,
      }),
    );
  }

  // Restores the archive into a staging directory and snapshots the live data before swapping
  // the directories and reopening the runtime. When the restored data cannot be opened, the
  // previous directory is moved back, so a failed import never leaves the user without data.
  async function importBackup(
    command: Extract<LocalBackendCommand, { type: "backup:import" }>,
  ): Promise<LocalBackupSummary> {
    const current = runtime;
    const currentOptions = runtimeOptions;
    if (!current || !currentOptions) throw new LocalBackupHostError("Your local data is not open.");
    if (!options.prepareImport) throw new Error("Backup import is not available");
    const { dataDir } = currentOptions;
    const stagingDir = `${dataDir}.import`;
    const previousDir = `${dataDir}.previous`;

    const manifest = await options.prepareImport({
      archivePath: command.archivePath,
      stagingDir,
    });
    try {
      await mkdir(dirname(command.snapshotPath), { recursive: true });
      await current.exportBackup({
        outputPath: command.snapshotPath,
        appVersion: command.appVersion,
      });
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true });
      throw new LocalBackupHostError(
        "Your current data could not be backed up first, so nothing was imported.",
        { cause: error },
      );
    }

    runtime = undefined;
    // Event streams belong to the closing runtime; clients reconnect to the new one.
    server?.closeAllConnections();
    await current.close();
    await rm(previousDir, { recursive: true, force: true });
    try {
      await rename(dataDir, previousDir);
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true });
      runtime = await createRuntime(currentOptions);
      throw new LocalBackupHostError(
        "Your data folder could not be replaced, so nothing was imported.",
        { cause: error },
      );
    }
    try {
      await rename(stagingDir, dataDir);
      runtime = await createRuntime(currentOptions);
    } catch (error) {
      if (await exists(dataDir)) await rm(dataDir, { recursive: true, force: true });
      await rename(previousDir, dataDir);
      await rm(stagingDir, { recursive: true, force: true });
      runtime = await createRuntime(currentOptions);
      throw new LocalBackupHostError(
        "The imported data could not be opened. Your previous data was restored.",
        { cause: error },
      );
    }
    await rm(previousDir, { recursive: true, force: true });
    return summarize(manifest);
  }

  function runBackup(
    requestId: string,
    work: () => Promise<LocalBackupSummary>,
    failureMessage: string,
  ): void {
    backupQueue = backupQueue.then(work).then(
      (summary) => parentPort.postMessage({ type: "backup:result", requestId, summary }),
      (error: unknown) => {
        const userFacing = error instanceof Error && error.name === userFacingErrorName;
        if (!userFacing) console.error(failureMessage, error);
        parentPort.postMessage({
          type: "backup:error",
          requestId,
          message: userFacing ? error.message : failureMessage,
        });
      },
    );
  }

  async function stop(): Promise<void> {
    await backupQueue;
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
      case "backup:export":
        runBackup(
          command.requestId,
          () => exportBackup(command),
          "The backup could not be created. Please try again.",
        );
        return;
      case "backup:import":
        runBackup(
          command.requestId,
          () => importBackup(command),
          "The backup could not be imported. Your existing data was not changed.",
        );
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

function summarize(manifest: LocalBackendBackupManifest): LocalBackupSummary {
  return {
    createdAt: manifest.createdAt,
    appVersion: manifest.appVersion,
    applications: manifest.tables.find((table) => table.name === "job_applications")?.rows ?? 0,
    files: manifest.files,
  };
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

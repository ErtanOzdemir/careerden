import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createServer, type RequestListener, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname } from "node:path";
import type { DocumentRenderer } from "@careerden/domain";
import type { AiProviderSelection, AiProviderSelectionSource } from "@careerden/infrastructure";
import { describeErrorForLog, type StructuredLogger } from "@careerden/infrastructure/logging";
import {
  parseLocalBackendCommand,
  type LocalBackendCommand,
  type LocalBackendEvent,
  type LocalBackupSummary,
  type LocalDatabaseDiagnostics,
  type LocalDataStartupFailure,
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
  lastMigration?: string | undefined;
  describeDatabase?(): Promise<LocalDatabaseDiagnostics>;
  close(): Promise<void>;
}

export type CreateLocalBackendRuntime = (options: {
  dataDir: string;
  sessionToken: string;
  pdfRenderer: DocumentRenderer;
  aiProviderSelection: AiProviderSelectionSource;
  dataSnapshots: { appVersion: string; backupsDir: string; log: (message: string) => void };
  logger: StructuredLogger;
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
  // Recognizes errors that mean the local data cannot be opened, which retrying will not fix.
  describeStartupError?: (error: unknown) => LocalDataStartupFailure | undefined;
  // How long requests in flight at shutdown may take before their connections are dropped.
  requestDrainTimeoutMs?: number;
  // Ends the process once shutdown is over; the utility process passes process.exit.
  exit?: (code: number) => void;
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
  // The main process owns the log file; entries travel over the parent port.
  const logger: StructuredLogger = (entry) => parentPort.postMessage({ type: "log", entry });
  // Backups run one at a time, and an import replaces the runtime the next one uses.
  let backupQueue: Promise<unknown> = Promise.resolve();
  let starting: Promise<void> | undefined;
  let shuttingDown: Promise<void> | undefined;
  const openResponses = new Set<ServerResponse>();

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
        dataSnapshots: {
          appVersion: command.appVersion,
          backupsDir: command.backupsDir,
          // Snapshot messages hold versions, snapshot IDs, and sizes only.
          log: (message) =>
            logger({ level: "info", event: "data_snapshot.updated", fields: { message } }),
        },
        logger,
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
      listening.on("request", (_request, response: ServerResponse) => {
        openResponses.add(response);
        response.once("close", () => openResponses.delete(response));
      });
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
    if (shuttingDown) {
      parentPort.postMessage({ type: "backup:error", requestId, message: failureMessage });
      return;
    }
    backupQueue = backupQueue.then(work).then(
      (summary) => parentPort.postMessage({ type: "backup:result", requestId, summary }),
      (error: unknown) => {
        const userFacing = error instanceof Error && error.name === userFacingErrorName;
        logger({
          level: userFacing ? "warn" : "error",
          event: "backup.failed",
          fields: { task: failureMessage, ...describeErrorForLog(error) },
        });
        parentPort.postMessage({
          type: "backup:error",
          requestId,
          message: userFacing ? error.message : failureMessage,
        });
      },
    );
  }

  // Answers with whatever is known; a closed runtime or a failed query leaves fields out.
  async function describeDatabase(requestId: string): Promise<void> {
    const current = runtime;
    let database: LocalDatabaseDiagnostics = {};
    try {
      database = (await current?.describeDatabase?.()) ?? {};
    } catch (error) {
      logger({
        level: "warn",
        event: "diagnostics.database_failed",
        fields: describeErrorForLog(error),
      });
    }
    if (!database.lastMigration && current?.lastMigration) {
      database = { ...database, lastMigration: current.lastMigration };
    }
    parentPort.postMessage({ type: "diagnostics:result", requestId, database });
  }

  // Stops accepting connections, drops event streams, which never end on their own, and gives
  // other requests in flight a moment to finish before their connections are dropped too.
  async function closeServer(): Promise<void> {
    const current = server;
    server = undefined;
    if (!current) return;
    const closed = new Promise<void>((resolve) => current.close(() => resolve()));
    for (const response of openResponses) {
      if (String(response.getHeader("content-type") ?? "").startsWith("text/event-stream")) {
        response.destroy();
      }
    }
    current.closeIdleConnections();
    let timeout: NodeJS.Timeout | undefined;
    const drained = await Promise.race([
      closed.then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), options.requestDrainTimeoutMs ?? 1_000);
      }),
    ]);
    clearTimeout(timeout);
    if (!drained) {
      current.closeAllConnections();
      await closed;
    }
  }

  // Closing the runtime stops its background work and closes the database, so PGlite never exits
  // with an open client or mid-write.
  async function shutdown(): Promise<void> {
    await starting;
    // A backup import swaps the data folder; let it finish rather than interrupt it.
    await backupQueue;
    await closeServer();
    await runtime?.close();
    runtime = undefined;
  }

  parentPort.on("message", (message) => {
    const command = parseLocalBackendCommand(message);
    if (!command) return;

    switch (command.type) {
      case "start":
        if (!shuttingDown) starting ??= start(command);
        return;
      case "shutdown":
        shuttingDown ??= shutdown().then(
          () => {
            parentPort.postMessage({ type: "shutdown:complete" });
            options.exit?.(0);
          },
          (error: unknown) => {
            logger({
              level: "error",
              event: "local_backend.shutdown_failed",
              fields: describeErrorForLog(error),
            });
            options.exit?.(1);
          },
        );
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
          "The backup could not be imported.",
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
      case "diagnostics:request":
        void describeDatabase(command.requestId);
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

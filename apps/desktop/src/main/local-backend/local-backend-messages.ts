import { aiProviderNames } from "@careerden/infrastructure";
import type { AiProviderSelection } from "@careerden/infrastructure";

// What the main process learns about a backup it exported or imported.
export interface LocalBackupSummary {
  createdAt: string;
  appVersion: string;
  applications: number;
  files: number;
}

// Mirrors localDatabaseStartupFailureReasons in @careerden/api-app/local, which the main process
// does not import: it would load the whole API.
export const localDataStartupFailureReasons = [
  "database-open",
  "migration",
  "newer-version",
] as const;

export type LocalDataStartupFailureReason = (typeof localDataStartupFailureReasons)[number];

// The local data could not be opened. Unlike a crash, retrying will not help.
export interface LocalDataStartupFailure {
  reason: LocalDataStartupFailureReason;
  message: string;
  lastMigration?: string;
  unknownMigrations?: string[];
}

// Main process -> local backend utility process.
export type LocalBackendCommand =
  | {
      type: "start";
      dataDir: string;
      sessionToken: string;
      port: number;
      // Recorded with the data after a successful launch; a change snapshots the data first.
      appVersion: string;
      // userData/backups, where pre-migration snapshots are kept.
      backupsDir: string;
      // Appended with snapshot creation and pruning.
      logFile: string;
    }
  | { type: "stop" }
  | { type: "backup:export"; requestId: string; outputPath: string; appVersion: string }
  | {
      type: "backup:import";
      requestId: string;
      archivePath: string;
      // Where the data being replaced is exported first.
      snapshotPath: string;
      appVersion: string;
    }
  | { type: "pdf:result"; requestId: string; pdf: Uint8Array }
  | { type: "pdf:error"; requestId: string; message: string }
  | { type: "ai-selection:result"; requestId: string; selection: AiProviderSelection | null };

// Local backend utility process -> main process.
export type LocalBackendEvent =
  | { type: "ready"; port: number; lastMigration?: string }
  | { type: "start:error"; message: string }
  | { type: "start:data-error"; failure: LocalDataStartupFailure }
  | { type: "stopped" }
  | { type: "pdf:request"; requestId: string; html: string }
  | { type: "ai-selection:request"; requestId: string }
  | { type: "backup:result"; requestId: string; summary: LocalBackupSummary }
  | { type: "backup:error"; requestId: string; message: string };

export function parseLocalBackendCommand(message: unknown): LocalBackendCommand | undefined {
  const payload = asRecord(unwrapMessageEvent(message));
  if (!payload) return undefined;

  switch (payload.type) {
    case "start":
      return isString(payload.dataDir) &&
        isString(payload.sessionToken) &&
        Number.isInteger(payload.port) &&
        isString(payload.appVersion) &&
        isString(payload.backupsDir) &&
        isString(payload.logFile)
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "stop":
      return { type: "stop" };
    case "backup:export":
      return isString(payload.requestId) &&
        isString(payload.outputPath) &&
        isString(payload.appVersion)
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "backup:import":
      return isString(payload.requestId) &&
        isString(payload.archivePath) &&
        isString(payload.snapshotPath) &&
        isString(payload.appVersion)
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "pdf:result":
      return isString(payload.requestId) && payload.pdf instanceof Uint8Array
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "pdf:error":
      return isString(payload.requestId) && isString(payload.message)
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "ai-selection:result":
      return isString(payload.requestId) &&
        (payload.selection === null || isAiProviderSelection(payload.selection))
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    default:
      return undefined;
  }
}

export function parseLocalBackendEvent(message: unknown): LocalBackendEvent | undefined {
  const payload = asRecord(unwrapMessageEvent(message));
  if (!payload) return undefined;

  switch (payload.type) {
    case "ready":
      return Number.isInteger(payload.port) &&
        (payload.lastMigration === undefined || isString(payload.lastMigration))
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    case "start:error":
      return isString(payload.message) ? (payload as unknown as LocalBackendEvent) : undefined;
    case "start:data-error":
      return isLocalDataStartupFailure(payload.failure)
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    case "stopped":
      return { type: "stopped" };
    case "pdf:request":
      return isString(payload.requestId) && isString(payload.html)
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    case "ai-selection:request":
      return isString(payload.requestId) ? (payload as unknown as LocalBackendEvent) : undefined;
    case "backup:result":
      return isString(payload.requestId) && isLocalBackupSummary(payload.summary)
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    case "backup:error":
      return isString(payload.requestId) && isString(payload.message)
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    default:
      return undefined;
  }
}

function isAiProviderSelection(value: unknown): value is AiProviderSelection {
  const selection = asRecord(value);
  return (
    selection !== undefined &&
    aiProviderNames.some((name) => name === selection.provider) &&
    isString(selection.apiKey) &&
    (selection.model === undefined || isString(selection.model))
  );
}

function isLocalBackupSummary(value: unknown): value is LocalBackupSummary {
  const summary = asRecord(value);
  return (
    summary !== undefined &&
    isString(summary.createdAt) &&
    isString(summary.appVersion) &&
    Number.isInteger(summary.applications) &&
    Number.isInteger(summary.files)
  );
}

function isLocalDataStartupFailure(value: unknown): value is LocalDataStartupFailure {
  const failure = asRecord(value);
  return (
    failure !== undefined &&
    localDataStartupFailureReasons.some((reason) => reason === failure.reason) &&
    isString(failure.message) &&
    (failure.lastMigration === undefined || isString(failure.lastMigration)) &&
    (failure.unknownMigrations === undefined ||
      (Array.isArray(failure.unknownMigrations) && failure.unknownMigrations.every(isString)))
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function unwrapMessageEvent(message: unknown): unknown {
  if (typeof message === "object" && message !== null && "data" in message && "ports" in message) {
    return (message as { data: unknown }).data;
  }

  return message;
}

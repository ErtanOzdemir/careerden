import { aiProviderNames } from "@careerden/infrastructure";
import type { AiProviderSelection } from "@careerden/infrastructure";

// Mirrors localDatabaseStartupFailureReasons in @careerden/api-app/local, which the main process
// does not import: it would load the whole API.
export const localDataStartupFailureReasons = ["database-open", "migration", "newer-version"] as const;

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
  | { type: "start"; dataDir: string; sessionToken: string; port: number }
  | { type: "stop" }
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
  | { type: "ai-selection:request"; requestId: string };

export function parseLocalBackendCommand(message: unknown): LocalBackendCommand | undefined {
  const payload = asRecord(unwrapMessageEvent(message));
  if (!payload) return undefined;

  switch (payload.type) {
    case "start":
      return isString(payload.dataDir) &&
        isString(payload.sessionToken) &&
        Number.isInteger(payload.port)
        ? (payload as unknown as LocalBackendCommand)
        : undefined;
    case "stop":
      return { type: "stop" };
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

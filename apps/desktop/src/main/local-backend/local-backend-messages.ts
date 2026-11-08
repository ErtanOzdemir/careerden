import { aiProviderNames } from "@careerden/infrastructure";
import type { AiProviderSelection } from "@careerden/infrastructure";
import type { StructuredLogEntry } from "@careerden/infrastructure/logging";
import { parseStructuredLogMessage } from "../logging/structured-log-message.js";

// Main process -> local backend utility process.
export type LocalBackendCommand =
  | { type: "start"; dataDir: string; sessionToken: string; port: number }
  | { type: "stop" }
  | { type: "pdf:result"; requestId: string; pdf: Uint8Array }
  | { type: "pdf:error"; requestId: string; message: string }
  | { type: "ai-selection:result"; requestId: string; selection: AiProviderSelection | null };

// Local backend utility process -> main process.
export type LocalBackendEvent =
  | { type: "ready"; port: number }
  | { type: "start:error"; message: string }
  | { type: "stopped" }
  | { type: "pdf:request"; requestId: string; html: string }
  | { type: "ai-selection:request"; requestId: string }
  | { type: "log"; entry: StructuredLogEntry };

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
      return Number.isInteger(payload.port) ? (payload as unknown as LocalBackendEvent) : undefined;
    case "start:error":
      return isString(payload.message) ? (payload as unknown as LocalBackendEvent) : undefined;
    case "stopped":
      return { type: "stopped" };
    case "pdf:request":
      return isString(payload.requestId) && isString(payload.html)
        ? (payload as unknown as LocalBackendEvent)
        : undefined;
    case "ai-selection:request":
      return isString(payload.requestId) ? (payload as unknown as LocalBackendEvent) : undefined;
    case "log": {
      const entry = parseStructuredLogMessage(payload);
      return entry ? { type: "log", entry } : undefined;
    }
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

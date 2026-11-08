import { isLogLevel } from "@careerden/infrastructure/logging";
import type { LogFieldValue, StructuredLogEntry } from "@careerden/infrastructure/logging";

// Utility processes have no log file of their own; they post entries to the main process.
export interface StructuredLogMessage {
  type: "log";
  entry: StructuredLogEntry;
}

export function createStructuredLogMessage(entry: StructuredLogEntry): StructuredLogMessage {
  return { type: "log", entry };
}

// Validates a log message from a utility process. Fields that are not primitives are dropped so a
// child can never smuggle a whole object into the log.
export function parseStructuredLogMessage(message: unknown): StructuredLogEntry | undefined {
  const payload = asRecord(unwrapMessageEvent(message));
  if (payload?.type !== "log") return undefined;

  const entry = asRecord(payload.entry);
  if (!entry || !isLogLevel(entry.level) || typeof entry.event !== "string") return undefined;

  const fields: Record<string, LogFieldValue> = {};
  for (const [key, value] of Object.entries(asRecord(entry.fields) ?? {})) {
    if (isLogFieldValue(value)) fields[key] = value;
  }

  return { level: entry.level, event: entry.event, fields };
}

function isLogFieldValue(value: unknown): value is LogFieldValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function unwrapMessageEvent(message: unknown): unknown {
  if (typeof message === "object" && message !== null && "data" in message && "ports" in message) {
    return (message as { data: unknown }).data;
  }

  return message;
}

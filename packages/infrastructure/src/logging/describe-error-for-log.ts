import { redactSensitiveLogText } from "./redact-sensitive-log-text.js";
import type { LogFieldValue } from "./structured-log.js";

const maximumMessageLength = 300;
const maximumCauseDepth = 3;

// Errors whose message embeds model output, which must never reach a log file.
const modelOutputErrorNames = new Set([
  "AiOutputValidationError",
  "AI_NoObjectGeneratedError",
  "AI_TypeValidationError",
  "AI_JSONParseError",
]);

// Flattens an error into log fields: its name, code, HTTP status, and a short redacted message.
// Stacks, response bodies, and request data are left out on purpose.
export function describeErrorForLog(error: unknown): Record<string, LogFieldValue> {
  if (!(error instanceof Error)) {
    return { errorName: "NonErrorThrown" };
  }

  const fields: Record<string, LogFieldValue> = { errorName: redact(error.name, 100) };
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") {
    fields.errorCode = redact(String(code), 100);
  }

  const statusCode = findStatusCode(error);
  if (statusCode !== undefined) fields.statusCode = statusCode;

  if (!carriesModelOutput(error) && error.message) {
    fields.errorMessage = redact(error.message, maximumMessageLength);
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.name !== error.name) {
    fields.causeName = redact(cause.name, 100);
  }

  return fields;
}

function carriesModelOutput(error: Error): boolean {
  return modelOutputErrorNames.has(error.name) || "modelText" in error || "text" in error;
}

function findStatusCode(error: unknown, depth = 0): number | undefined {
  if (typeof error !== "object" || error === null || depth > maximumCauseDepth) return undefined;

  const candidate = error as {
    cause?: unknown;
    lastError?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  for (const value of [candidate.statusCode, candidate.status]) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
      return value;
    }
  }

  return (
    findStatusCode(candidate.lastError, depth + 1) ?? findStatusCode(candidate.cause, depth + 1)
  );
}

function redact(value: string, maximumLength: number): string {
  const redacted = redactSensitiveLogText(value);
  return redacted.length > maximumLength ? `${redacted.slice(0, maximumLength)}...` : redacted;
}

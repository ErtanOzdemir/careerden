import type { NextFunction, Request, Response } from "express";
import type { TraceIdRequest } from "./trace-id.middleware.js";
import { ApplicationError } from "@careerden/application";

const internalErrorMessage = "Internal server error";
const maximumLogTextLength = 16_384;

export interface UnexpectedApiErrorLog {
  error: {
    cause?: UnexpectedApiErrorLog["error"];
    code?: string;
    message: string;
    name: string;
    stack?: string;
  };
  event: "api.unexpected_error";
  request: {
    method?: string;
    path?: string;
  };
  traceId?: string;
}

export type UnexpectedApiErrorLogger = (entry: UnexpectedApiErrorLog) => void;

export function createErrorHandler(
  logUnexpectedError: UnexpectedApiErrorLogger = defaultUnexpectedErrorLogger,
) {
  return function handleError(
    error: unknown,
    request: Request,
    response: Response,
    _next: NextFunction,
  ): void {
    const traceId = (request as TraceIdRequest).traceId;

    if (error instanceof ApplicationError) {
      const status = {
        conflict: 409,
        forbidden: 403,
        not_found: 404,
        payment_required: 402,
        validation: 400,
      }[error.code];

      response.status(status).json({ ...error.details, code: error.code, error: error.message });
      return;
    }

    logUnexpectedError({
      error: serializeError(error),
      event: "api.unexpected_error",
      request: {
        ...(request.method ? { method: request.method } : {}),
        ...(request.path ? { path: request.path } : {}),
      },
      ...(traceId ? { traceId } : {}),
    });

    response.status(500).json({
      code: "internal",
      error: internalErrorMessage,
      ...(traceId ? { traceId } : {}),
    });
  };
}

export const errorHandler = createErrorHandler();

function defaultUnexpectedErrorLogger(entry: UnexpectedApiErrorLog): void {
  console.error("Unexpected API error", entry);
}

function serializeError(error: unknown, depth = 0): UnexpectedApiErrorLog["error"] {
  if (!(error instanceof Error)) {
    return {
      message: redactSensitiveLogText(String(error)),
      name: "NonErrorThrown",
    };
  }

  const errorWithMetadata = error as Error & { cause?: unknown; code?: unknown };

  return {
    message: redactSensitiveLogText(error.message),
    name: redactSensitiveLogText(error.name),
    ...(typeof errorWithMetadata.code === "string"
      ? { code: redactSensitiveLogText(errorWithMetadata.code) }
      : {}),
    ...(error.stack ? { stack: redactSensitiveLogText(error.stack) } : {}),
    ...(errorWithMetadata.cause !== undefined && depth < 2
      ? { cause: serializeError(errorWithMetadata.cause, depth + 1) }
      : {}),
  };
}

export function redactSensitiveLogText(value: string): string {
  const redacted = value
    .replace(/\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi, "$1: [REDACTED]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, "$1[REDACTED]@")
    .replace(
      /(["']?\b(?:password|passcode|secret|token|otp|api[_-]?key|access[_-]?key|refresh[_-]?token)\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;\r\n]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]");

  return redacted.length > maximumLogTextLength
    ? `${redacted.slice(0, maximumLogTextLength)}...[TRUNCATED]`
    : redacted;
}

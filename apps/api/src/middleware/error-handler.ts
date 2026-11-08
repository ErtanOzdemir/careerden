import type { NextFunction, Request, Response } from "express";
import type { TraceIdRequest } from "./trace-id.middleware.js";
import { ApplicationError } from "@careerden/application";
import { redactSensitiveLogText } from "@careerden/infrastructure";

const internalErrorMessage = "Internal server error";

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

// The original error is passed too, so a logger can apply its own, stricter field selection.
export type UnexpectedApiErrorLogger = (entry: UnexpectedApiErrorLog, error: unknown) => void;

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
        ai_provider_not_configured: 409,
        conflict: 409,
        forbidden: 403,
        not_found: 404,
        payment_required: 402,
        validation: 400,
      }[error.code];

      response.status(status).json({ ...error.details, code: error.code, error: error.message });
      return;
    }

    logUnexpectedError(
      {
        error: serializeError(error),
        event: "api.unexpected_error",
        request: {
          ...(request.method ? { method: request.method } : {}),
          ...(request.path ? { path: request.path } : {}),
        },
        ...(traceId ? { traceId } : {}),
      },
      error,
    );

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

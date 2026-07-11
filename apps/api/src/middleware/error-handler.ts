import type { NextFunction, Request, Response } from "express";
import type { TraceIdRequest } from "./trace-id.middleware.js";
import { ApplicationError } from "@link2cv/application";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  const traceId = (request as TraceIdRequest).traceId;

  if (error instanceof ApplicationError) {
    const status = {
      conflict: 409,
      forbidden: 403,
      not_found: 404,
      validation: 400,
    }[error.code];

    response.status(status).json({ error: error.message, ...error.details });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  response.status(500).json({
    error: message,
    ...(traceId ? { traceId } : {}),
  });
}

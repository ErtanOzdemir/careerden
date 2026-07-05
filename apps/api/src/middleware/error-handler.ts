import type { NextFunction, Request, Response } from "express";
import type { TraceIdRequest } from "./trace-id.middleware.js";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const traceId = (request as TraceIdRequest).traceId;

  response.status(500).json({
    error: message,
    ...(traceId ? { traceId } : {}),
  });
}

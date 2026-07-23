import { context, trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";

export interface TraceIdRequest extends Request {
  traceId?: string;
}

export function traceIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const traceId = getActiveTraceId() ?? randomBytes(16).toString("hex");

  (request as TraceIdRequest).traceId = traceId;
  response.setHeader("x-trace-id", traceId);

  next();
}

function getActiveTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId;

  if (!traceId || traceId === "00000000000000000000000000000000") {
    return undefined;
  }

  return traceId;
}

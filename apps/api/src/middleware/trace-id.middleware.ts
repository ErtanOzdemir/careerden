import { context, trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

export interface TraceIdRequest extends Request {
  traceId?: string;
}

export function traceIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const traceId = getActiveTraceId();

  if (traceId) {
    (request as TraceIdRequest).traceId = traceId;
    response.setHeader("x-trace-id", traceId);
  }

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

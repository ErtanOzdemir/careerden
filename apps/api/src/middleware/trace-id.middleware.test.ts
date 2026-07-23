import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { context, trace, type Span } from "@opentelemetry/api";
import { traceIdMiddleware } from "./trace-id.middleware.js";

describe("traceIdMiddleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sets the active OpenTelemetry trace id on the response and request", () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c";
    const request = {} as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;
    vi.spyOn(trace, "getSpan").mockReturnValue(createSpan(traceId));

    traceIdMiddleware(request, response, next);

    expect(trace.getSpan).toHaveBeenCalledWith(context.active());
    expect(response.setHeader).toHaveBeenCalledWith("x-trace-id", traceId);
    expect(request).toMatchObject({ traceId });
    expect(next).toHaveBeenCalledOnce();
  });

  it("generates a trace id when there is no active span", () => {
    const request = {} as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;
    vi.spyOn(trace, "getSpan").mockReturnValue(undefined);

    traceIdMiddleware(request, response, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      "x-trace-id",
      expect.stringMatching(/^[0-9a-f]{32}$/),
    );
    expect(request).toMatchObject({
      traceId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      "x-trace-id",
      (request as Request & { traceId: string }).traceId,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});

function createResponse(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

function createSpan(traceId: string): Span {
  return {
    spanContext: () => ({
      traceId,
      spanId: "b9c7c989f97918e1",
      traceFlags: 1,
    }),
  } as Span;
}

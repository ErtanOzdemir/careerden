import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler.js";
import type { TraceIdRequest } from "./trace-id.middleware.js";

describe("errorHandler", () => {
  it("includes the request trace id in 500 responses when present", () => {
    const response = createResponse();

    errorHandler(
      new Error("Something failed"),
      { traceId: "0af7651916cd43dd8448eb211c80319c" } as TraceIdRequest,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Something failed",
      traceId: "0af7651916cd43dd8448eb211c80319c",
    });
  });

  it("keeps the existing error response shape when no trace id exists", () => {
    const response = createResponse();

    errorHandler(new Error("Something failed"), {} as Request, response, vi.fn() as NextFunction);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Something failed",
    });
  });
});

function createResponse(): Response {
  const response = {
    json: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  return response as unknown as Response;
}

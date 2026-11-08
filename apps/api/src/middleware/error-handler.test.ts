import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import { createErrorHandler, errorHandler } from "./error-handler.js";
import type { TraceIdRequest } from "./trace-id.middleware.js";

describe("errorHandler", () => {
  it("maps typed application failures to transport responses", () => {
    const response = createResponse();

    errorHandler(
      new ApplicationError("validation", "Unknown placeholders", { unknown: ["missing"] }),
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: "validation",
      error: "Unknown placeholders",
      unknown: ["missing"],
    });
  });

  it("maps insufficient credits to HTTP 402 with machine-readable amounts", () => {
    const response = createResponse();

    errorHandler(
      new ApplicationError("payment_required", "Not enough credits.", {
        requiredCredits: 1,
        availableCredits: 0,
      }),
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(402);
    expect(response.json).toHaveBeenCalledWith({
      code: "payment_required",
      error: "Not enough credits.",
      requiredCredits: 1,
      availableCredits: 0,
    });
  });

  it("maps AI provider failures to HTTP 502 with the failure category", () => {
    const response = createResponse();

    errorHandler(
      new ApplicationError("ai_provider_error", "The selected model is no longer available.", {
        aiFailure: { category: "model_unavailable", provider: "openrouter", statusCode: 404 },
      }),
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith({
      code: "ai_provider_error",
      error: "The selected model is no longer available.",
      aiFailure: { category: "model_unavailable", provider: "openrouter", statusCode: 404 },
    });
  });

  it("does not let application details override stable error fields", () => {
    const response = createResponse();

    errorHandler(
      new ApplicationError("conflict", "Claim conflict", {
        code: "internal",
        error: "Overridden",
      }),
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      code: "conflict",
      error: "Claim conflict",
    });
  });

  it("includes the request trace id in 500 responses when present", () => {
    const response = createResponse();
    const logger = vi.fn();
    const handler = createErrorHandler(logger);

    handler(
      new Error("Something failed"),
      {
        method: "GET",
        path: "/api/job-applications",
        traceId: "0af7651916cd43dd8448eb211c80319c",
      } as TraceIdRequest,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: "internal",
      error: "Internal server error",
      traceId: "0af7651916cd43dd8448eb211c80319c",
    });
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api.unexpected_error",
        request: {
          method: "GET",
          path: "/api/job-applications",
        },
        traceId: "0af7651916cd43dd8448eb211c80319c",
      }),
    );
  });

  it("keeps the existing error response shape when no trace id exists", () => {
    const response = createResponse();
    const handler = createErrorHandler(vi.fn());

    handler(new Error("Something failed"), {} as Request, response, vi.fn() as NextFunction);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: "internal",
      error: "Internal server error",
    });
  });

  it("redacts secrets from structured unexpected error logs", () => {
    const response = createResponse();
    const logger = vi.fn();
    const handler = createErrorHandler(logger);
    const error = new Error(
      [
        "database failed password=database-password",
        "token=reset-token",
        "https://admin:database-password@postgres.internal/careerden",
        "Authorization: Bearer bearer-secret",
        "api_key=sk-abcdefghijklmnop",
      ].join("\n"),
    );
    error.stack = [
      error.message,
      "Cookie: session=session-secret",
      "otp=123456",
      "AKIAIOSFODNN7EXAMPLE",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    ].join("\n");

    handler(
      error,
      {
        body: { profile: "full-profile-payload" },
        headers: { authorization: "Bearer request-secret" },
        method: "POST",
        path: "/api/job-applications",
        query: { resetToken: "query-secret" },
        traceId: "0af7651916cd43dd8448eb211c80319c",
      } as unknown as TraceIdRequest,
      response,
      vi.fn() as NextFunction,
    );

    const publicPayload = JSON.stringify(response.json.mock.calls);
    const loggedPayload = JSON.stringify(logger.mock.calls);

    expect(publicPayload).toContain("Internal server error");
    expect(publicPayload).not.toContain("database failed");
    expect(loggedPayload).toContain("[REDACTED]");
    for (const secret of [
      "database-password",
      "reset-token",
      "bearer-secret",
      "sk-abcdefghijklmnop",
      "session-secret",
      "123456",
      "AKIAIOSFODNN7EXAMPLE",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
      "full-profile-payload",
      "request-secret",
      "query-secret",
    ]) {
      expect(loggedPayload).not.toContain(secret);
    }
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

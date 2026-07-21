import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { CareerdenAuth } from "./auth.js";
import { requireSession } from "./session.middleware.js";

describe("requireSession", () => {
  it("returns a coded unauthorized response when no session exists", async () => {
    const auth = {
      api: { getSession: vi.fn(async () => null) },
    } as unknown as CareerdenAuth;
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await requireSession(auth)({ headers: {} } as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      code: "unauthorized",
      error: "Unauthorized",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

function createResponse(): Response {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

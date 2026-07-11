import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { validateBody } from "./validate-body.js";

describe("validateBody", () => {
  it("returns a coded validation response", () => {
    const request = { body: {} } as Request;
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    validateBody(z.object({ name: z.string() }))(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: "validation",
      error: "Invalid request body",
      issues: expect.any(Array),
    });
    expect(next).not.toHaveBeenCalled();
  });
});

function createResponse(): Response {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

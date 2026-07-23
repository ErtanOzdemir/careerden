import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  apiContentSecurityPolicy,
  createSecurityHeadersMiddleware,
} from "./security-headers.middleware.js";

describe("securityHeadersMiddleware", () => {
  it("sets restrictive API security headers and production HSTS", () => {
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    createSecurityHeadersMiddleware({ enableHsts: true })({} as Request, response, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy",
      apiContentSecurityPolicy,
    );
    expect(apiContentSecurityPolicy).toContain("default-src 'none'");
    expect(apiContentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Permissions-Policy",
      "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
    expect(response.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(response.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("omits HSTS outside production", () => {
    const response = createResponse();

    createSecurityHeadersMiddleware({ enableHsts: false })(
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.setHeader).not.toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.anything(),
    );
  });
});

function createResponse(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

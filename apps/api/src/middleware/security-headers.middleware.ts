import type { NextFunction, Request, Response } from "express";

export const apiContentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const permissionsPolicy =
  "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()";
const strictTransportSecurity = "max-age=31536000";

export function createSecurityHeadersMiddleware(options: { enableHsts: boolean }) {
  return function securityHeadersMiddleware(
    _request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    response.setHeader("Content-Security-Policy", apiContentSecurityPolicy);
    response.setHeader("Permissions-Policy", permissionsPolicy);
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");

    if (options.enableHsts) {
      response.setHeader("Strict-Transport-Security", strictTransportSecurity);
    }

    next();
  };
}

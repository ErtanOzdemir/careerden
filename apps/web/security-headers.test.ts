import { describe, expect, it } from "vitest";
import { createWebContentSecurityPolicy, createWebSecurityHeaders } from "./security-headers.js";

describe("web security headers", () => {
  it("creates a strict production policy with the configured API origin", () => {
    const headers = createWebSecurityHeaders({
      apiBaseUrl: "https://api.example.com/base",
      development: false,
    });
    const contentSecurityPolicy = headers["Content-Security-Policy"];

    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://api.example.com");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).not.toContain("fonts.googleapis.com");
    expect(headers).toMatchObject({
      "Permissions-Policy":
        "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });

  it("allows development tooling without adding untrusted API schemes", () => {
    const contentSecurityPolicy = createWebContentSecurityPolicy({
      apiBaseUrl: "javascript:alert(1)",
      development: true,
    });
    const headers = createWebSecurityHeaders({ development: true });

    expect(contentSecurityPolicy).toContain("script-src 'self' 'unsafe-eval'");
    expect(contentSecurityPolicy).toContain("connect-src 'self' ws: wss:");
    expect(contentSecurityPolicy).not.toContain("javascript:");
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });
});

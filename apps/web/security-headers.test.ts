import { describe, expect, it } from "vitest";
import {
  createWebContentSecurityPolicy,
  createWebMetaContentSecurityPolicy,
  createWebSecurityHeaders,
} from "./security-headers.js";

describe("web security headers", () => {
  it("creates a strict production policy with the configured API origin", () => {
    const headers = createWebSecurityHeaders({
      apiBaseUrl: "https://api.example.com/base",
      development: false,
    });
    const contentSecurityPolicy = headers["Content-Security-Policy"];

    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).not.toContain(
      "'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='",
    );
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://api.example.com");
    expect(contentSecurityPolicy).toContain("frame-src 'self' https:");
    expect(contentSecurityPolicy).toContain("img-src 'self' data: https:");
    expect(contentSecurityPolicy).not.toContain("http://localhost:*");
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
    expect(contentSecurityPolicy).toContain(
      "'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='",
    );
    expect(
      contentSecurityPolicy.split("; ").find((directive) => directive.startsWith("script-src ")),
    ).not.toContain("'unsafe-inline'");
    expect(contentSecurityPolicy).toContain("connect-src 'self' ws: wss:");
    expect(contentSecurityPolicy).toContain(
      "frame-src 'self' https: http://localhost:* http://127.0.0.1:*",
    );
    expect(contentSecurityPolicy).toContain(
      "img-src 'self' data: https: http://localhost:* http://127.0.0.1:*",
    );
    expect(contentSecurityPolicy).not.toContain("javascript:");
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("keeps frame ancestry in response headers but omits the ineffective meta directive", () => {
    const contentSecurityPolicy = createWebContentSecurityPolicy({
      development: false,
    });
    const metaContentSecurityPolicy = createWebMetaContentSecurityPolicy(contentSecurityPolicy);

    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(metaContentSecurityPolicy).not.toContain("frame-ancestors");
    expect(metaContentSecurityPolicy).toContain("script-src 'self'");
  });
});

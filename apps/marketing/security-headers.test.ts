import { describe, expect, it, vi } from "vitest";

vi.mock("node:url", () => ({
  default: { fileURLToPath: () => process.cwd() },
  fileURLToPath: () => process.cwd(),
}));

import {
  createMarketingContentSecurityPolicy,
  createMarketingSecurityHeaders,
} from "./next.config.js";

describe("marketing security headers", () => {
  it("sets production browser defenses without third-party resource origins", () => {
    const headers = Object.fromEntries(
      createMarketingSecurityHeaders(false).map(({ key, value }) => [key, value]),
    );
    const contentSecurityPolicy = headers["Content-Security-Policy"];

    expect(contentSecurityPolicy).toContain("script-src 'self' 'unsafe-inline'");
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy).not.toContain("https:");
    expect(headers).toMatchObject({
      "Permissions-Policy":
        "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });

  it("allows the Next.js development runtime and omits HSTS", () => {
    const headers = createMarketingSecurityHeaders(true);

    expect(createMarketingContentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(headers).not.toContainEqual(
      expect.objectContaining({ key: "Strict-Transport-Security" }),
    );
  });
});

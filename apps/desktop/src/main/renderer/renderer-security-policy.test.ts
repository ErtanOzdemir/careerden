import { describe, expect, it, vi } from "vitest";
import {
  configureRendererPermissionPolicy,
  getAllowedExternalUrl,
  isAllowedRendererNavigation,
} from "./renderer-security-policy.js";

describe("renderer security policy", () => {
  it("allows navigation only within the trusted renderer authority", () => {
    expect(
      isAllowedRendererNavigation(
        "https://localhost:5173/applications/123",
        "https://localhost:5173",
      ),
    ).toBe(true);
    expect(isAllowedRendererNavigation("careerden://app/settings", "careerden://app")).toBe(true);

    expect(isAllowedRendererNavigation("https://attacker.example", "https://localhost:5173")).toBe(
      false,
    );
    expect(isAllowedRendererNavigation("http://localhost:5173", "https://localhost:5173")).toBe(
      false,
    );
    expect(
      isAllowedRendererNavigation("https://user:password@localhost:5173", "https://localhost:5173"),
    ).toBe(false);
  });

  it("requires an exact file URL for an unpackaged local renderer", () => {
    const trustedUrl = "file:///opt/careerden/renderer/index.html";

    expect(isAllowedRendererNavigation(trustedUrl, trustedUrl)).toBe(true);
    expect(
      isAllowedRendererNavigation("file:///opt/careerden/renderer/other.html", trustedUrl),
    ).toBe(false);
  });

  it.each([
    ["https://github.com/careerden/releases", "https://github.com/careerden/releases"],
    ["mailto:support@careerden.app", "mailto:support@careerden.app"],
  ])("allows a safe external URL: %s", (value, expected) => {
    expect(getAllowedExternalUrl(value)).toBe(expected);
  });

  it.each([
    "http://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "smb://fileserver/share",
    "vscode://file/etc/passwd",
    "https://user:password@example.com",
    "https://example.com/\u0000hidden",
    " https://example.com",
    "not a URL",
  ])("rejects an unsafe external URL: %s", (value) => {
    expect(getAllowedExternalUrl(value)).toBeUndefined();
  });

  it("denies renderer permission checks and requests by default", () => {
    const setPermissionCheckHandler = vi.fn();
    const setPermissionRequestHandler = vi.fn();

    configureRendererPermissionPolicy({
      setPermissionCheckHandler,
      setPermissionRequestHandler,
    });

    const checkHandler = setPermissionCheckHandler.mock.calls[0]?.[0];
    const requestHandler = setPermissionRequestHandler.mock.calls[0]?.[0];
    const callback = vi.fn();

    expect(checkHandler?.({} as never, "media", "https://app.example.com", {})).toBe(false);
    requestHandler?.({} as never, "media", callback, {});
    expect(callback).toHaveBeenCalledWith(false);
  });
});

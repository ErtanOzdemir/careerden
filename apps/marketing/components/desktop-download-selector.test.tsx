import { describe, expect, it } from "vitest";
import { detectDesktopPlatform } from "./desktop-download-selector";

describe("desktop platform detection", () => {
  it.each([
    ["Windows 11", { userAgentData: { platform: "Windows" } }, "windows"],
    ["macOS", { platform: "MacIntel" }, "macos"],
    ["Linux", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }, "linux"],
  ])("detects %s", (_label, navigatorDetails, expectedPlatform) => {
    expect(detectDesktopPlatform(navigatorDetails)).toBe(expectedPlatform);
  });

  it.each([
    { platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
    { platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 15)" },
    { platform: "Unknown", userAgent: "Custom browser" },
  ])("does not offer a desktop installer to mobile or unknown systems", (navigatorDetails) => {
    expect(detectDesktopPlatform(navigatorDetails)).toBeNull();
  });
});

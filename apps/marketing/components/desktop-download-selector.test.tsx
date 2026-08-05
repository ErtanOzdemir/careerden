import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopRelease, type DesktopDownload } from "@/lib/desktop-release";
import {
  DesktopDownloadGrid,
  DetectedDownloadButton,
  detectDesktopPlatform,
} from "./desktop-download-selector";

const architectureSpecificMacDownloads = [
  {
    platform: "macos",
    platformName: "macOS",
    format: "DMG",
    architecture: "Apple Silicon",
    fileName: "Careerden-0.4.0-arm64.dmg",
    size: "130 MB",
    url: "https://example.com/Careerden-0.4.0-arm64.dmg",
  },
  {
    platform: "macos",
    platformName: "macOS",
    format: "DMG",
    architecture: "Intel",
    fileName: "Careerden-0.4.0-x64.dmg",
    size: "135 MB",
    url: "https://example.com/Careerden-0.4.0-x64.dmg",
  },
] satisfies DesktopDownload[];

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("architecture-specific desktop downloads", () => {
  it("keeps a direct download when the detected platform has one artifact", async () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");

    render(<DetectedDownloadButton release={desktopRelease} />);

    expect(await screen.findByRole("link", { name: /Download for macOS/i })).toHaveAttribute(
      "href",
      desktopRelease.downloads[0].url,
    );
  });

  it("groups Apple Silicon and Intel artifacts under one macOS card", () => {
    render(<DesktopDownloadGrid downloads={architectureSpecificMacDownloads} />);

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "macOS" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Careerden-0\.4\.0-arm64\.dmg/i })).toHaveAttribute(
      "href",
      "https://example.com/Careerden-0.4.0-arm64.dmg",
    );
    expect(screen.getByRole("link", { name: /Careerden-0\.4\.0-x64\.dmg/i })).toHaveAttribute(
      "href",
      "https://example.com/Careerden-0.4.0-x64.dmg",
    );
  });

  it("asks detected Mac users to choose an architecture", async () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");

    render(
      <DetectedDownloadButton
        release={{
          version: "0.4.0",
          publishedLabel: "August 5, 2026",
          downloads: architectureSpecificMacDownloads,
        }}
      />,
    );

    expect(
      await screen.findByRole("link", { name: /Choose your macOS download/i }),
    ).toHaveAttribute("href", "#download-macos");
    expect(screen.getByText(/Apple Silicon or Intel/)).toBeVisible();
  });
});

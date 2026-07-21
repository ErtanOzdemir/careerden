import { describe, expect, it, vi } from "vitest";
import { loadDesktopApiBaseUrl, normalizeDesktopApiBaseUrl } from "./desktop-runtime-config.js";

describe("loadDesktopApiBaseUrl", () => {
  it("loads the API URL embedded in a packaged desktop build", () => {
    const readFile = vi.fn(() =>
      JSON.stringify({ apiBaseUrl: "https://api.careerden.example/v1/" }),
    );

    expect(
      loadDesktopApiBaseUrl({
        configPath: "/app/dist/main/desktop-runtime-config.json",
        environment: { DESKTOP_API_BASE_URL: "https://ignored.example" },
        isPackaged: true,
        readFile,
      }),
    ).toBe("https://api.careerden.example/v1");
    expect(readFile).toHaveBeenCalledWith("/app/dist/main/desktop-runtime-config.json");
  });

  it("uses desktop development environment variables before the localhost default", () => {
    expect(
      loadDesktopApiBaseUrl({
        configPath: "unused",
        environment: {
          DESKTOP_API_BASE_URL: "https://desktop.example/",
          VITE_API_BASE_URL: "https://vite.example",
        },
        isPackaged: false,
      }),
    ).toBe("https://desktop.example");
    expect(
      loadDesktopApiBaseUrl({
        configPath: "unused",
        environment: {},
        isPackaged: false,
      }),
    ).toBe("http://localhost:3000");
  });

  it("rejects missing, malformed, and unsafe packaged API URLs", () => {
    expect(() =>
      loadDesktopApiBaseUrl({
        configPath: "config.json",
        environment: {},
        isPackaged: true,
        readFile: () => JSON.stringify({}),
      }),
    ).toThrow("packaged desktop runtime configuration is invalid");
    expect(() => normalizeDesktopApiBaseUrl("file:///tmp/api")).toThrow("must use HTTP or HTTPS");
    expect(() => normalizeDesktopApiBaseUrl("https://user:secret@example.com")).toThrow(
      "cannot contain credentials",
    );
  });
});

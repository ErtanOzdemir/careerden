import { describe, expect, it, vi } from "vitest";
import {
  loadDesktopRuntimeConfig,
  normalizeDesktopApiBaseUrl,
  normalizeDesktopUpdateRepository,
} from "./desktop-runtime-config.js";

describe("loadDesktopRuntimeConfig", () => {
  it("loads the API URL and update repository embedded in a packaged desktop build", () => {
    const readFile = vi.fn(() =>
      JSON.stringify({
        apiBaseUrl: "https://api.careerden.example/v1/",
        desktopUpdateRepository: "fork-owner/careerden",
      }),
    );

    expect(
      loadDesktopRuntimeConfig({
        configPath: "/app/dist/main/desktop-runtime-config.json",
        environment: { DESKTOP_API_BASE_URL: "https://ignored.example" },
        isPackaged: true,
        readFile,
      }),
    ).toEqual({
      apiBaseUrl: "https://api.careerden.example/v1",
      desktopUpdateRepository: "fork-owner/careerden",
    });
    expect(readFile).toHaveBeenCalledWith("/app/dist/main/desktop-runtime-config.json");
  });

  it("uses desktop development environment variables before the localhost default", () => {
    expect(
      loadDesktopRuntimeConfig({
        configPath: "unused",
        environment: {
          DESKTOP_API_BASE_URL: "https://desktop.example/",
          DESKTOP_UPDATE_REPOSITORY: "fork-owner/careerden",
          VITE_API_BASE_URL: "https://vite.example",
        },
        isPackaged: false,
      }),
    ).toEqual({
      apiBaseUrl: "https://desktop.example",
      desktopUpdateRepository: "fork-owner/careerden",
    });
    expect(
      loadDesktopRuntimeConfig({
        configPath: "unused",
        environment: {},
        isPackaged: false,
      }),
    ).toEqual({ apiBaseUrl: "http://localhost:3000" });
  });

  it("rejects missing, malformed, and unsafe packaged configuration", () => {
    expect(() =>
      loadDesktopRuntimeConfig({
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
    expect(() => normalizeDesktopUpdateRepository("owner")).toThrow("owner/repository");
    expect(() => normalizeDesktopUpdateRepository("owner/repo/extra")).toThrow("owner/repository");
  });
});

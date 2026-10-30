import { describe, expect, it, vi } from "vitest";
import {
  loadDesktopRuntimeConfig,
  normalizeDesktopEdition,
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
      edition: "cloud",
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
      edition: "cloud",
      apiBaseUrl: "https://desktop.example",
      desktopUpdateRepository: "fork-owner/careerden",
    });
    expect(
      loadDesktopRuntimeConfig({
        configPath: "unused",
        environment: {},
        isPackaged: false,
      }),
    ).toEqual({ edition: "cloud", apiBaseUrl: "http://localhost:3000" });
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

describe("loadDesktopRuntimeConfig for the local edition", () => {
  it("loads a packaged local build without any API URL", () => {
    expect(
      loadDesktopRuntimeConfig({
        configPath: "config.json",
        environment: {},
        isPackaged: true,
        readFile: () =>
          JSON.stringify({ edition: "local", desktopUpdateRepository: "owner/careerden" }),
      }),
    ).toEqual({ edition: "local", desktopUpdateRepository: "owner/careerden" });
  });

  it("rejects a packaged local build that names an API URL", () => {
    expect(() =>
      loadDesktopRuntimeConfig({
        configPath: "config.json",
        environment: {},
        isPackaged: true,
        readFile: () => JSON.stringify({ edition: "local", apiBaseUrl: "https://api.example" }),
      }),
    ).toThrow("packaged desktop runtime configuration is invalid");
  });

  it("reads the edition and an optional fixed development backend from the environment", () => {
    expect(
      loadDesktopRuntimeConfig({
        configPath: "unused",
        environment: { CAREERDEN_EDITION: "local" },
        isPackaged: false,
      }),
    ).toEqual({ edition: "local" });
    expect(
      loadDesktopRuntimeConfig({
        configPath: "unused",
        environment: {
          CAREERDEN_EDITION: "local",
          CAREERDEN_LOCAL_DEV_PORT: "3010",
          CAREERDEN_LOCAL_DEV_TOKEN: "dev-token",
        },
        isPackaged: false,
      }),
    ).toEqual({ edition: "local", developmentBackend: { port: 3010, sessionToken: "dev-token" } });
  });

  it("rejects a partial or invalid development backend and unknown editions", () => {
    const load = (environment: NodeJS.ProcessEnv) =>
      loadDesktopRuntimeConfig({ configPath: "unused", environment, isPackaged: false });

    expect(() => load({ CAREERDEN_EDITION: "local", CAREERDEN_LOCAL_DEV_PORT: "3010" })).toThrow(
      "Set both",
    );
    expect(() =>
      load({
        CAREERDEN_EDITION: "local",
        CAREERDEN_LOCAL_DEV_PORT: "80",
        CAREERDEN_LOCAL_DEV_TOKEN: "dev-token",
      }),
    ).toThrow("between 1024 and 65535");
    expect(() => normalizeDesktopEdition("offline")).toThrow("cloud, local");
    expect(normalizeDesktopEdition(undefined)).toBe("cloud");
  });
});

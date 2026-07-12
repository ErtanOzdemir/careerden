import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoredTheme,
  initializeTheme,
  setThemePreference,
  subscribeToThemeChanges,
  THEME_STORAGE_KEY,
  themes,
} from "./theme.js";

describe("theme preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    delete window.electronAPI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(themes)("reads the stored %s theme", (theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    expect(getStoredTheme()).toBe(theme);
  });

  it.each([null, "sepia", "DARK"])(
    "defaults a missing or invalid stored value to system",
    (value) => {
      if (value !== null) {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
      }

      expect(getStoredTheme()).toBe("system");
    },
  );

  it("synchronizes the stored theme with the document and native window at startup", () => {
    const setNativeThemeSource = installElectronApi();
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.documentElement.classList.add("light");

    expect(initializeTheme()).toBe("dark");

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(setNativeThemeSource).toHaveBeenCalledWith("dark");
  });

  it("uses system at startup when storage contains an invalid value", () => {
    const setNativeThemeSource = installElectronApi();
    window.localStorage.setItem(THEME_STORAGE_KEY, "invalid");
    document.documentElement.classList.add("dark");

    expect(initializeTheme()).toBe("system");

    expect(document.documentElement).not.toHaveClass("light", "dark");
    expect(setNativeThemeSource).toHaveBeenCalledWith("system");
  });

  it.each(themes)("persists and applies the %s theme", (theme) => {
    const setNativeThemeSource = installElectronApi();
    document.documentElement.classList.add("light", "dark");

    setThemePreference(theme);

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme);
    expect(document.documentElement.classList.contains("light")).toBe(theme === "light");
    expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");
    expect(setNativeThemeSource).toHaveBeenCalledWith(theme);
  });

  it("applies browser-only theme changes without an Electron bridge", () => {
    expect(() => setThemePreference("dark")).not.toThrow();

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("keeps the renderer theme when native synchronization fails", async () => {
    const error = new Error("IPC unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installElectronApi().mockRejectedValue(error);

    setThemePreference("dark");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to synchronize the native theme.", error);
    });
  });

  it("keeps synchronizing cross-window changes after startup on any route", () => {
    const setNativeThemeSource = installElectronApi();
    initializeTheme();
    setNativeThemeSource.mockClear();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
      }),
    );

    expect(document.documentElement).toHaveClass("light");
    expect(setNativeThemeSource).toHaveBeenCalledWith("light");
  });

  it("validates and synchronizes cross-window storage changes", () => {
    const setNativeThemeSource = installElectronApi();
    const onChange = vi.fn();
    const unsubscribe = subscribeToThemeChanges(onChange);
    document.documentElement.classList.add("dark");

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "not-a-theme",
      }),
    );

    expect(onChange).toHaveBeenCalledWith("system");
    expect(document.documentElement).not.toHaveClass("light", "dark");
    expect(setNativeThemeSource).toHaveBeenCalledWith("system");

    unsubscribe();
  });
});

function installElectronApi() {
  const setNativeThemeSource = vi.fn().mockResolvedValue(undefined);
  window.electronAPI = {
    getLinkedInSessionStatus: vi.fn(),
    startLinkedInSession: vi.fn(),
    saveLinkedInSession: vi.fn(),
    notifyJobApplicationQueued: vi.fn(),
    setNativeThemeSource,
  };
  return setNativeThemeSource;
}

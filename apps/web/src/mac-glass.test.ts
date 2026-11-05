import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeMacGlass, macGlassAttribute, supportsMacGlass } from "./mac-glass.js";

describe("macOS sidebar glass", () => {
  beforeEach(() => {
    delete window.electronAPI;
    document.documentElement.removeAttribute(macGlassAttribute);
    installMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is available in the macOS desktop app", () => {
    installElectronApi("darwin");

    expect(supportsMacGlass()).toBe(true);
  });

  it.each(["win32", "linux"])("keeps the solid sidebar on %s", (platform) => {
    installElectronApi(platform);

    expect(supportsMacGlass()).toBe(false);
  });

  it("keeps the solid sidebar in the browser, where there is no vibrancy to reveal", () => {
    expect(supportsMacGlass()).toBe(false);
  });

  it("respects the macOS reduce transparency setting", () => {
    installElectronApi("darwin");
    installMatchMedia(true);

    expect(supportsMacGlass()).toBe(false);
  });

  it("marks the document only while the glass surface applies", () => {
    installElectronApi("darwin");
    initializeMacGlass();

    expect(document.documentElement.hasAttribute(macGlassAttribute)).toBe(true);

    delete window.electronAPI;
    initializeMacGlass();

    expect(document.documentElement.hasAttribute(macGlassAttribute)).toBe(false);
  });

  it("re-evaluates when the reduce transparency setting changes", () => {
    installElectronApi("darwin");
    const query = installMatchMedia(false);
    const unsubscribe = initializeMacGlass();

    expect(document.documentElement.hasAttribute(macGlassAttribute)).toBe(true);

    query.matches = true;
    for (const listener of query.listeners) listener();

    expect(document.documentElement.hasAttribute(macGlassAttribute)).toBe(false);

    unsubscribe();
    expect(query.listeners.size).toBe(0);
  });

  it("keeps the glass surface when the media feature is unknown", () => {
    installElectronApi("darwin");
    vi.spyOn(window, "matchMedia").mockImplementation(() => {
      throw new Error("Unknown media feature");
    });

    expect(supportsMacGlass()).toBe(true);
  });

  function installElectronApi(platform: string) {
    window.electronAPI = {
      platform,
      notifyJobApplicationQueued: vi.fn().mockResolvedValue(undefined),
    };
  }

  function installMatchMedia(matches: boolean) {
    const query = {
      matches,
      listeners: new Set<() => void>(),
      addEventListener: (_event: string, listener: () => void) => {
        query.listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        query.listeners.delete(listener);
      },
    };

    vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);
    return query;
  }
});

import { describe, expect, it } from "vitest";
import { getMainWindowOptions } from "./main-window-options.js";

describe("getMainWindowOptions", () => {
  it("keeps native macOS window controls visible with a hidden titlebar", () => {
    const options = getMainWindowOptions("/tmp/preload.cjs", "darwin");

    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.trafficLightPosition).toEqual({ x: 14, y: 14 });
    expect(options.frame).toBeUndefined();
    expect(options.backgroundColor).toBe("#ffffff");
    expect(options.hasShadow).toBe(true);
    expect(options.autoHideMenuBar).toBe(true);
  });

  it("uses a custom frameless window on non-mac platforms", () => {
    const options = getMainWindowOptions("/tmp/preload.cjs", "win32");

    expect(options.frame).toBe(false);
    expect(options.backgroundColor).toBe("#ffffff");
    expect(options.hasShadow).toBe(true);
    expect(options.autoHideMenuBar).toBe(true);
  });
});

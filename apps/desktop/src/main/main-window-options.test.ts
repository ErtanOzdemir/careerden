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
    expect(options.title).toBe("Careerden");
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it("uses a custom frameless window on non-mac platforms", () => {
    const options = getMainWindowOptions("/tmp/preload.cjs", "win32");

    expect(options.frame).toBe(false);
    expect(options.backgroundColor).toBe("#ffffff");
    expect(options.hasShadow).toBe(true);
    expect(options.autoHideMenuBar).toBe(true);
    expect(options.title).toBe("Careerden");
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it("names the window after the edition and passes the edition to the preload", () => {
    const cloud = getMainWindowOptions("/tmp/preload.cjs", "darwin");
    const local = getMainWindowOptions("/tmp/preload.cjs", "darwin", "local");

    expect(cloud.webPreferences?.additionalArguments).toEqual(["--careerden-edition=cloud"]);
    expect(local.title).toBe("Careerden Local");
    expect(local.webPreferences?.additionalArguments).toEqual(["--careerden-edition=local"]);
  });
});

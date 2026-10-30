import type { BrowserWindowConstructorOptions } from "electron";
import { getDesktopAppIdentity } from "./desktop-app-identity.js";
import type { DesktopEdition } from "./desktop-runtime-config.js";

export function getMainWindowOptions(
  preloadPath: string,
  platform: NodeJS.Platform = process.platform,
  edition: DesktopEdition = "cloud",
): BrowserWindowConstructorOptions {
  const options: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: getDesktopAppIdentity(edition).name,
    backgroundColor: "#ffffff",
    hasShadow: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The preload exposes edition-specific capabilities from this flag.
      additionalArguments: [`--careerden-edition=${edition}`],
    },
  };

  if (platform === "darwin") {
    return {
      ...options,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  return {
    ...options,
    frame: false,
  };
}

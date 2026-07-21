import type { BrowserWindowConstructorOptions } from "electron";
import { desktopAppIdentity } from "./desktop-app-identity.js";

export function getMainWindowOptions(
  preloadPath: string,
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  const options: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: desktopAppIdentity.name,
    backgroundColor: "#ffffff",
    hasShadow: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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

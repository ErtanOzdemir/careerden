import type { BrowserWindow } from "electron";

export type WindowControlAction = "minimize" | "toggle-maximize" | "close";

export function applyWindowControl(window: BrowserWindow, action: WindowControlAction): void {
  switch (action) {
    case "minimize":
      window.minimize();
      break;
    case "toggle-maximize":
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      break;
    case "close":
      window.close();
      break;
  }
}

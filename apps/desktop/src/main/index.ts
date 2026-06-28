import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { getMainWindowOptions } from "./main-window-options.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow(
    getMainWindowOptions(join(__dirname, "..", "preload", "index.cjs")),
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const isDev = process.env.NODE_ENV === "development";
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (isDev && devServerUrl) {
    const url = new URL(devServerUrl);
    if (process.env.VITE_API_BASE_URL) {
      url.searchParams.set("apiBaseUrl", process.env.VITE_API_BASE_URL);
    }
    void mainWindow.loadURL(url.toString());
  } else {
    void mainWindow.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
  }
}

void app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

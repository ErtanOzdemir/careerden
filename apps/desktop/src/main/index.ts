import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { startDesktopServer, type DesktopServer } from "./server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;
let desktopServer: DesktopServer | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Link2CV",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const isDev = process.env.NODE_ENV === "development";
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (isDev && devServerUrl) {
    const url = new URL(devServerUrl);
    if (desktopServer) {
      url.searchParams.set("apiPort", String(desktopServer.port));
      if (desktopServer.defaultProfileId) {
        url.searchParams.set("profileId", desktopServer.defaultProfileId);
      }
    }
    void mainWindow.loadURL(url.toString());
  } else {
    void mainWindow.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
  }
}

void app.whenReady().then(async () => {
  registerIpcHandlers();
  desktopServer = await startDesktopServer({
    premiumApiUrl: process.env.LINK2CV_PREMIUM_API_URL,
    premiumApiTokenProvider: async () => {
      return process.env.LINK2CV_PREMIUM_API_TOKEN ?? null;
    },
  });
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

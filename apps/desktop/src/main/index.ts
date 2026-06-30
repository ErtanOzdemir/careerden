import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { getMainWindowOptions } from "./main-window-options.js";
import { applyWindowControl, type WindowControlAction } from "./window-controls.js";
import {
  CheckLinkedInSessionUseCase,
  GetAppPathUseCase,
  SaveLinkedInSessionUseCase,
  ScrapeLinkedInJobUseCase,
  StartLinkedInSessionUseCase,
} from "@link2cv/application";
import {
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
} from "@link2cv/infrastructure";

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
  const sessionManager = new LinkedInSessionManager(
    join(app.getPath("userData"), "linkedin-session"),
    process.env.LINKEDIN_SESSION_SECRET ?? "dev-local-linkedin-session-secret",
  );

  const jobScraper = new LinkedInJobScraper(sessionManager);
  const companyLinkedInScraper = new LinkedInCompanyScraper(sessionManager);

  const getAppPath = new GetAppPathUseCase({
    getPath: (name: string) => app.getPath(name as Parameters<typeof app.getPath>[0]),
  });
  const checkLinkedInSession = new CheckLinkedInSessionUseCase(sessionManager);
  const startLinkedInSession = new StartLinkedInSessionUseCase(sessionManager);
  const saveLinkedInSession = new SaveLinkedInSessionUseCase(sessionManager);
  const scrapeLinkedInJob = new ScrapeLinkedInJobUseCase(jobScraper, companyLinkedInScraper);

  new IpcHandlerRegistry()
    .register("open-external", (_event, url: string) => {
      void shell.openExternal(url);
    })
    .register("get-app-path", (_event, name: string) => getAppPath.execute(name))
    .register("linkedin-session-status", async () => checkLinkedInSession.execute())
    .register("linkedin-session-start", async () => startLinkedInSession.execute())
    .register("linkedin-session-save", async () => saveLinkedInSession.execute())
    .register("linkedin-scrape-job", async (_event, sourceUrl: string) =>
      scrapeLinkedInJob.execute(sourceUrl),
    )
    .register("window-control", (event, action: WindowControlAction) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return;
      }
      applyWindowControl(window, action);
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

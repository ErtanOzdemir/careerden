import { app, BrowserWindow, nativeTheme, session, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { getMainWindowOptions } from "./main-window-options.js";
import { setNativeThemeSource } from "./native-theme-source.js";
import { DesktopApiClient } from "./scraping/desktop-api-client.js";
import { getDesktopScrapingClaimOwner } from "./scraping/desktop-scraping-identity.js";
import { LocalScrapingWorker } from "./scraping/local-scraping-worker.js";
import { UtilityProcessLinkedInScrapingRunner } from "./scraping/utility-process-linkedin-scraping-runner.js";
import { applyWindowControl, type WindowControlAction } from "./window-controls.js";
import {
  CheckLinkedInSessionUseCase,
  GetAppPathUseCase,
  SaveLinkedInSessionUseCase,
  StartLinkedInSessionUseCase,
} from "@link2cv/application";
import { LinkedInSessionManager } from "@link2cv/infrastructure";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appName = "Link2CV";

let mainWindow: BrowserWindow | null = null;
let localScrapingWorker: LocalScrapingWorker | null = null;
let utilityScrapingRunner: UtilityProcessLinkedInScrapingRunner | null = null;
let flushCookiesTimeout: NodeJS.Timeout | undefined;
let isQuittingAfterCookieFlush = false;

app.setName(appName);

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
  registerAuthCookiePersistence();

  const sessionDirectory = join(app.getPath("userData"), "linkedin-session");
  const sessionSecret = process.env.LINKEDIN_SESSION_SECRET ?? "dev-local-linkedin-session-secret";
  const sessionManager = new LinkedInSessionManager(sessionDirectory, sessionSecret);

  const getAppPath = new GetAppPathUseCase({
    getPath: (name: string) => app.getPath(name as Parameters<typeof app.getPath>[0]),
  });
  const checkLinkedInSession = new CheckLinkedInSessionUseCase(sessionManager);
  const startLinkedInSession = new StartLinkedInSessionUseCase(sessionManager);
  const saveLinkedInSession = new SaveLinkedInSessionUseCase(sessionManager);
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://localhost:3000";
  const claimedBy = getDesktopScrapingClaimOwner();
  utilityScrapingRunner = new UtilityProcessLinkedInScrapingRunner({
    modulePath: join(__dirname, "scraping", "scraping-utility-process.js"),
    sessionDirectory,
    sessionSecret,
  });

  localScrapingWorker = new LocalScrapingWorker({
    api: new DesktopApiClient({
      apiBaseUrl,
      claimedBy,
      getCookies: () => session.defaultSession.cookies.get({ url: apiBaseUrl }),
    }),
    runner: utilityScrapingRunner,
  });
  localScrapingWorker.start();

  new IpcHandlerRegistry()
    .register("open-external", (_event, url: string) => {
      void shell.openExternal(url);
    })
    .register("get-app-path", (_event, name: string) => getAppPath.execute(name))
    .register("linkedin-session-status", async () => checkLinkedInSession.execute())
    .register("linkedin-session-start", async () => startLinkedInSession.execute())
    .register("linkedin-session-save", async () => saveLinkedInSession.execute())
    .register("job-application-queued", () => localScrapingWorker?.wake())
    .register("set-native-theme-source", (_event, source: unknown) => {
      setNativeThemeSource(nativeTheme, source);
    })
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

app.on("before-quit", (event) => {
  if (isQuittingAfterCookieFlush) {
    return;
  }

  event.preventDefault();
  localScrapingWorker?.stop();
  utilityScrapingRunner?.dispose();
  void flushDefaultSessionCookies().finally(() => {
    isQuittingAfterCookieFlush = true;
    app.quit();
  });
});

function registerAuthCookiePersistence(): void {
  session.defaultSession.cookies.on("changed", (_event, cookie) => {
    if (isAuthCookie(cookie.name)) {
      scheduleCookieFlush();
      localScrapingWorker?.wake();
    }
  });
}

function scheduleCookieFlush(): void {
  if (flushCookiesTimeout) {
    clearTimeout(flushCookiesTimeout);
  }

  flushCookiesTimeout = setTimeout(() => {
    flushCookiesTimeout = undefined;
    void flushDefaultSessionCookies();
  }, 500);
}

async function flushDefaultSessionCookies(): Promise<void> {
  if (flushCookiesTimeout) {
    clearTimeout(flushCookiesTimeout);
    flushCookiesTimeout = undefined;
  }

  await session.defaultSession.cookies.flushStore();
}

function isAuthCookie(name: string): boolean {
  const normalized = name.replace(/^__(Secure|Host)-/, "");
  return normalized === "session_token" || /(^|[.-])session_token$/.test(normalized);
}

import {
  app,
  BrowserWindow,
  nativeTheme,
  net,
  Notification,
  protocol,
  session,
  shell,
} from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDesktopApiBaseUrl } from "./desktop-runtime-config.js";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { getMainWindowOptions } from "./main-window-options.js";
import { setNativeThemeSource } from "./native-theme-source.js";
import { DesktopNotificationActivationQueue } from "./notifications/desktop-notification-activation.js";
import { DesktopNotificationCoordinator } from "./notifications/desktop-notification-coordinator.js";
import { desktopNotificationIpcChannels } from "./notifications/desktop-notification-ipc.js";
import { DesktopNotificationStream } from "./notifications/desktop-notification-stream.js";
import {
  NativeNotificationPresenter,
  type DesktopNativeNotification,
} from "./notifications/native-notification-presenter.js";
import {
  createPackagedRendererProtocolHandler,
  packagedRendererScheme,
  packagedRendererSchemeRegistration,
  packagedRendererUrl,
} from "./renderer/packaged-renderer-protocol.js";
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
let mainWindowReady: Promise<BrowserWindow> | null = null;
let localScrapingWorker: LocalScrapingWorker | null = null;
let utilityScrapingRunner: UtilityProcessLinkedInScrapingRunner | null = null;
let notificationStream: DesktopNotificationStream | null = null;
let nativeNotificationPresenter: NativeNotificationPresenter | null = null;
let flushCookiesTimeout: NodeJS.Timeout | undefined;
let isQuittingAfterCookieFlush = false;
const notificationActivations = new DesktopNotificationActivationQueue();

protocol.registerSchemesAsPrivileged([packagedRendererSchemeRegistration]);
app.setName(appName);

if (process.platform === "win32") {
  app.setAppUserModelId("com.link2cv.desktop");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerDesktopLifecycle();
}

function registerDesktopLifecycle(): void {
  app.on("second-instance", () => {
    void activateMainWindow();
  });

  app.on("activate", () => {
    void activateMainWindow();
  });

  void app.whenReady().then(initializeDesktopRuntime);

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
    nativeNotificationPresenter?.closeAll();
    const stopNotificationStream = notificationStream?.stop() ?? Promise.resolve();

    void Promise.all([stopNotificationStream, flushDefaultSessionCookies()]).finally(() => {
      isQuittingAfterCookieFlush = true;
      app.quit();
    });
  });
}

async function initializeDesktopRuntime(): Promise<void> {
  if (process.platform === "darwin" && !app.isPackaged && app.dock) {
    app.dock.setIcon(join(__dirname, "..", "..", "build", "icon-dev.png"));
  }

  const apiBaseUrl = loadDesktopApiBaseUrl({
    configPath: join(__dirname, "desktop-runtime-config.json"),
    environment: process.env,
    isPackaged: app.isPackaged,
  });

  if (app.isPackaged) {
    session.defaultSession.protocol.handle(
      packagedRendererScheme,
      createPackagedRendererProtocolHandler({
        apiBaseUrl,
        fetchApi: (input, init) => session.defaultSession.fetch(input, init),
        fetchFile: (input, init) => net.fetch(input, init),
        onError: (error) => {
          console.error("Packaged renderer protocol error", error);
        },
        rendererDirectory: join(__dirname, "..", "..", "renderer"),
      }),
    );
  }

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

  nativeNotificationPresenter = new NativeNotificationPresenter({
    createNotification: createNativeNotification,
    onActivate: (activation) => {
      notificationActivations.add(activation);
      void activateMainWindow()
        .then((window) => {
          window.webContents.send(desktopNotificationIpcChannels.activationAvailable);
        })
        .catch((error: unknown) => {
          console.error("Failed to activate Link2CV from a native notification", error);
        });
    },
    onError: (error) => {
      console.error("Native notification error", error);
    },
  });

  const notificationCoordinator = new DesktopNotificationCoordinator({
    getWindow: () => {
      const window = getMainWindow();
      if (!window) return null;

      return {
        isFocused: () => window.isFocused(),
        notifyRenderer: () => {
          window.webContents.send(desktopNotificationIpcChannels.arrived);
        },
      };
    },
    showNativeNotification: (change) => {
      nativeNotificationPresenter?.show(change);
    },
  });

  notificationStream = new DesktopNotificationStream({
    apiBaseUrl,
    fetch: (input, init) => session.defaultSession.fetch(input, init),
    onChange: (change) => notificationCoordinator.received(change),
    onError: (error) => {
      console.error("Desktop notification stream error", error);
    },
  });

  new IpcHandlerRegistry()
    .register("open-external", (_event, url: string) => {
      void shell.openExternal(url);
    })
    .register("get-app-path", (_event, name: string) => getAppPath.execute(name))
    .register("linkedin-session-status", async () => checkLinkedInSession.execute())
    .register("linkedin-session-start", async () => startLinkedInSession.execute())
    .register("linkedin-session-save", async () => saveLinkedInSession.execute())
    .register("job-application-queued", () => localScrapingWorker?.wake())
    .register(desktopNotificationIpcChannels.consumeActivations, (event) => {
      const window = getMainWindow();
      if (!window || event.sender !== window.webContents) return [];
      return notificationActivations.takeAll();
    })
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
  notificationStream.start();
}

async function createWindow(): Promise<BrowserWindow> {
  const existingWindow = getMainWindow();
  if (existingWindow && mainWindowReady) return mainWindowReady;

  const window = new BrowserWindow(
    getMainWindowOptions(join(__dirname, "..", "preload", "index.cjs")),
  );
  mainWindow = window;

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      mainWindowReady = null;
    }
  });

  const isDev = process.env.NODE_ENV === "development";
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  let loadWindow: Promise<void>;

  if (isDev && devServerUrl) {
    const url = new URL(devServerUrl);
    if (process.env.VITE_API_BASE_URL) {
      url.searchParams.set("apiBaseUrl", process.env.VITE_API_BASE_URL);
    }
    loadWindow = window.loadURL(url.toString());
  } else if (app.isPackaged) {
    loadWindow = window.loadURL(packagedRendererUrl);
  } else {
    loadWindow = window.loadFile(join(__dirname, "..", "..", "renderer", "index.html"));
  }

  mainWindowReady = loadWindow
    .then(() => window)
    .catch((error: unknown) => {
      if (!window.isDestroyed()) window.destroy();
      throw error;
    });

  return mainWindowReady;
}

async function activateMainWindow(): Promise<BrowserWindow> {
  await app.whenReady();
  const window = await createWindow();

  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
  return window;
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function createNativeNotification(options: {
  body: string;
  title: string;
}): DesktopNativeNotification | null {
  if (!Notification.isSupported()) return null;

  const notification = new Notification({
    body: options.body,
    timeoutType: "default",
    title: options.title,
  });

  return {
    close: () => notification.close(),
    onClick: (listener) => {
      notification.once("click", () => listener());
    },
    onClose: (listener) => {
      notification.once("close", () => listener());
    },
    onFailed: (listener) => {
      notification.once("failed", (_event, error) => listener(error));
    },
    show: () => notification.show(),
  };
}

function registerAuthCookiePersistence(): void {
  session.defaultSession.cookies.on("changed", (_event, cookie) => {
    if (isAuthCookie(cookie.name)) {
      scheduleCookieFlush();
      localScrapingWorker?.wake();
      notificationStream?.wake();
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

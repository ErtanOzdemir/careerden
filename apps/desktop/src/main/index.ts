import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  net,
  Notification,
  protocol,
  session,
  shell,
} from "electron";
import electronUpdater from "electron-updater";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { desktopAppIdentity } from "./desktop-app-identity.js";
import { loadDesktopRuntimeConfig } from "./desktop-runtime-config.js";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { isTrustedMainWindowIpcSender } from "./ipc-sender-policy.js";
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
import { NativeNotificationPermissionRequester } from "./notifications/native-notification-permission-requester.js";
import {
  createPackagedRendererProtocolHandler,
  packagedRendererScheme,
  packagedRendererSchemeRegistration,
  packagedRendererUrl,
} from "./renderer/packaged-renderer-protocol.js";
import {
  configureRendererPermissionPolicy,
  getAllowedExternalUrl,
  isAllowedRendererNavigation,
} from "./renderer/renderer-security-policy.js";
import { DesktopApiClient } from "./scraping/desktop-api-client.js";
import { getDesktopScrapingClaimOwner } from "./scraping/desktop-scraping-identity.js";
import { LocalScrapingWorker } from "./scraping/local-scraping-worker.js";
import { UtilityProcessLinkedInScrapingRunner } from "./scraping/utility-process-linkedin-scraping-runner.js";
import { DesktopUpdateManager, type DesktopUpdater } from "./updates/desktop-update-manager.js";
import type { DesktopUpdatePolicy } from "./updates/desktop-update-policy.js";
import { desktopUpdateIpcChannels } from "./updates/desktop-update-types.js";
import { applyWindowControl, type WindowControlAction } from "./window-controls.js";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;
let mainWindowReady: Promise<BrowserWindow> | null = null;
let localScrapingWorker: LocalScrapingWorker | null = null;
let utilityScrapingRunner: UtilityProcessLinkedInScrapingRunner | null = null;
let notificationStream: DesktopNotificationStream | null = null;
let nativeNotificationPresenter: NativeNotificationPresenter | null = null;
let desktopUpdateManager: DesktopUpdateManager | null = null;
let flushCookiesTimeout: NodeJS.Timeout | undefined;
let isQuittingAfterCookieFlush = false;
const notificationActivations = new DesktopNotificationActivationQueue();

protocol.registerSchemesAsPrivileged([packagedRendererSchemeRegistration]);
app.setName(desktopAppIdentity.name);

if (process.platform === "win32") {
  app.setAppUserModelId(desktopAppIdentity.id);
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
    void shutdownDesktopRuntime().finally(() => {
      isQuittingAfterCookieFlush = true;
      app.quit();
    });
  });
}

async function initializeDesktopRuntime(): Promise<void> {
  if (process.platform === "darwin" && !app.isPackaged && app.dock) {
    app.dock.setIcon(join(__dirname, "..", "..", "build", "icon-dev.png"));
  }

  const runtimeConfig = loadDesktopRuntimeConfig({
    configPath: join(__dirname, "desktop-runtime-config.json"),
    environment: process.env,
    isPackaged: app.isPackaged,
  });
  const { apiBaseUrl, desktopUpdateRepository } = runtimeConfig;
  const desktopUpdatePolicyUrl = desktopUpdateRepository
    ? `https://github.com/${desktopUpdateRepository}/releases/latest/download/careerden-desktop-update-policy.json`
    : undefined;

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

  configureRendererPermissionPolicy(session.defaultSession);
  registerAuthCookiePersistence();

  const claimedBy = getDesktopScrapingClaimOwner();
  utilityScrapingRunner = new UtilityProcessLinkedInScrapingRunner({
    modulePath: join(__dirname, "scraping", "scraping-utility-process.js"),
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
          console.error("Failed to activate Careerden from a native notification", error);
        });
    },
    onError: (error) => {
      console.error("Native notification error", error);
    },
  });

  const nativeNotificationPermissionRequester = new NativeNotificationPermissionRequester({
    initialize: () => new Notification(),
    isSupported: () => Notification.isSupported(),
    onError: (error) => {
      console.error("Failed to request native notification permission", error);
    },
    platform: process.platform,
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

  const updatePolicyCachePath = join(app.getPath("userData"), "desktop-update-policy-cache.json");
  desktopUpdateManager = new DesktopUpdateManager({
    beforeInstall: async () => {
      await shutdownDesktopRuntime();
      isQuittingAfterCookieFlush = true;
    },
    currentVersion: app.getVersion(),
    fetchPolicy: async () => {
      if (!desktopUpdatePolicyUrl) {
        throw new Error("Desktop update repository is not configured");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await session.defaultSession.fetch(desktopUpdatePolicyUrl, {
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Update policy request failed with HTTP ${response.status}`);
        }
        return response.json();
      } finally {
        clearTimeout(timeout);
      }
    },
    isPackaged: app.isPackaged && desktopUpdateRepository !== undefined,
    onStateChange: (state) => {
      getMainWindow()?.webContents.send(desktopUpdateIpcChannels.stateChanged, state);
    },
    readCachedPolicy: async () => {
      try {
        return JSON.parse(await readFile(updatePolicyCachePath, "utf8")) as unknown;
      } catch (error) {
        if (isNodeErrorWithCode(error, "ENOENT")) return undefined;
        throw error;
      }
    },
    updater: electronUpdater.autoUpdater as DesktopUpdater,
    writeCachedPolicy: async (policy: DesktopUpdatePolicy) => {
      await mkdir(app.getPath("userData"), { recursive: true });
      await writeFile(updatePolicyCachePath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
    },
  });

  new IpcHandlerRegistry(ipcMain, (event) => isTrustedMainWindowIpcSender(event, getMainWindow()))
    .register("open-external", (_event, url: unknown) => {
      const allowedUrl = getAllowedExternalUrl(url);
      if (!allowedUrl) {
        return;
      }
      void shell.openExternal(allowedUrl);
    })
    .register("job-application-queued", () => localScrapingWorker?.wake())
    .register(desktopNotificationIpcChannels.consumeActivations, () =>
      notificationActivations.takeAll(),
    )
    .register(desktopNotificationIpcChannels.requestPermission, () => {
      nativeNotificationPermissionRequester.request();
    })
    .register(desktopUpdateIpcChannels.getState, () => desktopUpdateManager?.getState())
    .register(desktopUpdateIpcChannels.check, async () => {
      if (!desktopUpdateManager) {
        return undefined;
      }
      await desktopUpdateManager.checkForUpdates();
      return desktopUpdateManager.getState();
    })
    .register(desktopUpdateIpcChannels.restartAndInstall, () =>
      desktopUpdateManager?.restartAndInstall(),
    )
    .register("set-native-theme-source", (_event, source: unknown) => {
      setNativeThemeSource(nativeTheme, source);
    })
    .register("window-control", (_event, action: WindowControlAction) => {
      const window = getMainWindow();
      if (!window) {
        return;
      }
      applyWindowControl(window, action);
    });

  await createWindow();
  notificationStream.start();
  await desktopUpdateManager.start();
}

async function createWindow(): Promise<BrowserWindow> {
  const existingWindow = getMainWindow();
  if (existingWindow && mainWindowReady) return mainWindowReady;

  const window = new BrowserWindow(
    getMainWindowOptions(join(__dirname, "..", "preload", "index.cjs")),
  );
  mainWindow = window;

  window.webContents.setWindowOpenHandler(({ url }) => {
    const allowedUrl = getAllowedExternalUrl(url);
    if (allowedUrl) {
      void shell.openExternal(allowedUrl);
    }
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
  const localRendererPath = join(__dirname, "..", "..", "renderer", "index.html");
  const trustedRendererUrl =
    isDev && devServerUrl
      ? devServerUrl
      : app.isPackaged
        ? packagedRendererUrl
        : pathToFileURL(localRendererPath).toString();

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isAllowedRendererNavigation(navigationUrl, trustedRendererUrl)) {
      event.preventDefault();
    }
  });

  let loadWindow: Promise<void>;

  if (isDev && devServerUrl) {
    loadWindow = window.loadURL(devServerUrl);
  } else if (app.isPackaged) {
    loadWindow = window.loadURL(packagedRendererUrl);
  } else {
    loadWindow = window.loadFile(localRendererPath);
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

async function shutdownDesktopRuntime(): Promise<void> {
  localScrapingWorker?.stop();
  utilityScrapingRunner?.dispose();
  nativeNotificationPresenter?.closeAll();
  await Promise.all([
    notificationStream?.stop() ?? Promise.resolve(),
    flushDefaultSessionCookies(),
  ]);
}

function isAuthCookie(name: string): boolean {
  const normalized = name.replace(/^__(Secure|Host)-/, "");
  return normalized === "session_token" || /(^|[.-])session_token$/.test(normalized);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

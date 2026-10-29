import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  net,
  Notification,
  protocol,
  safeStorage,
  session,
  shell,
} from "electron";
import electronUpdater from "electron-updater";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerAiCredentialsIpc } from "./ai-credentials/ai-credentials-ipc.js";
import { AiCredentialsStore } from "./ai-credentials/ai-credentials-store.js";
import { getDesktopAppIdentity } from "./desktop-app-identity.js";
import { loadDesktopRuntimeConfig, type DesktopRuntimeConfig } from "./desktop-runtime-config.js";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { isTrustedMainWindowIpcSender } from "./ipc-sender-policy.js";
import { ElectronPdfRenderer } from "./local-backend/electron-pdf-renderer.js";
import { LocalBackendProcess } from "./local-backend/local-backend-process.js";
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

if (!app.isPackaged) {
  // Development defaults (dev server URL); variables already set in the environment win.
  const developmentEnvPath = join(__dirname, "..", "..", ".env.development");
  if (existsSync(developmentEnvPath)) process.loadEnvFile(developmentEnvPath);
}

const runtimeConfig = loadDesktopRuntimeConfig({
  configPath: join(__dirname, "desktop-runtime-config.json"),
  environment: process.env,
  isPackaged: app.isPackaged,
});
const appIdentity = getDesktopAppIdentity(runtimeConfig.edition);
const localSessionTokenHeader = "x-careerden-local-token";

let mainWindow: BrowserWindow | null = null;
let mainWindowReady: Promise<BrowserWindow> | null = null;
let localScrapingWorker: LocalScrapingWorker | null = null;
let utilityScrapingRunner: UtilityProcessLinkedInScrapingRunner | null = null;
let notificationStream: DesktopNotificationStream | null = null;
let nativeNotificationPresenter: NativeNotificationPresenter | null = null;
let desktopUpdateManager: DesktopUpdateManager | null = null;
let localBackend: LocalBackendProcess | null = null;
let flushCookiesTimeout: NodeJS.Timeout | undefined;
let isQuittingAfterCookieFlush = false;
const notificationActivations = new DesktopNotificationActivationQueue();

protocol.registerSchemesAsPrivileged([packagedRendererSchemeRegistration]);
app.setName(appIdentity.name);
if (runtimeConfig.edition === "local") {
  // Keep the local edition's database, files, and keys apart from the cloud edition's profile.
  app.setPath("userData", join(app.getPath("appData"), appIdentity.name));
}

if (process.platform === "win32") {
  app.setAppUserModelId(appIdentity.id);
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

  const { desktopUpdateRepository } = runtimeConfig;
  let aiCredentialsStore: AiCredentialsStore | undefined;
  let apiBaseUrl: string;
  let apiRequestHeaders: Record<string, string> = {};

  if (runtimeConfig.edition === "local") {
    aiCredentialsStore = new AiCredentialsStore(
      join(app.getPath("userData"), "ai-credentials.bin"),
      safeStorage,
    );
    try {
      const backend = await startLocalBackend(runtimeConfig, aiCredentialsStore);
      apiBaseUrl = backend.baseUrl;
      apiRequestHeaders = backend.headers;
    } catch (error) {
      console.error("Failed to start the local backend", error);
      dialog.showErrorBox(
        `${appIdentity.name} could not start`,
        `Your local data could not be opened. ${error instanceof Error ? error.message : ""}`.trim(),
      );
      app.exit(1);
      return;
    }
  } else {
    apiBaseUrl = runtimeConfig.apiBaseUrl;
  }
  // The local edition reaches its loopback backend with Node's fetch. It needs no cookies, so it
  // never opens Chromium's cookie store, whose encryption key would otherwise trigger a Keychain
  // prompt, and it is not bound by Chromium's six-connection limit per host.
  const fetchApi =
    runtimeConfig.edition === "local"
      ? (input: string, init?: RequestInit) => fetch(input, withHeaders(init, apiRequestHeaders))
      : (input: string, init?: RequestInit) => session.defaultSession.fetch(input, init);
  const desktopUpdatePolicyUrl = desktopUpdateRepository
    ? `https://github.com/${desktopUpdateRepository}/releases/latest/download/careerden-desktop-update-policy.json`
    : undefined;

  if (app.isPackaged) {
    session.defaultSession.protocol.handle(
      packagedRendererScheme,
      createPackagedRendererProtocolHandler({
        apiBaseUrl,
        apiRequestHeaders,
        fetchApi,
        fetchFile: (input, init) => net.fetch(input, init),
        onError: (error) => {
          console.error("Packaged renderer protocol error", error);
        },
        rendererDirectory: join(__dirname, "..", "..", "renderer"),
      }),
    );
  }

  configureRendererPermissionPolicy(session.defaultSession);
  if (runtimeConfig.edition === "cloud") registerAuthCookiePersistence();

  const claimedBy = getDesktopScrapingClaimOwner();
  utilityScrapingRunner = new UtilityProcessLinkedInScrapingRunner({
    modulePath: join(__dirname, "scraping", "scraping-utility-process.js"),
  });

  localScrapingWorker = new LocalScrapingWorker({
    api: new DesktopApiClient({
      apiBaseUrl,
      claimedBy,
      ...(runtimeConfig.edition === "local"
        ? { headers: apiRequestHeaders }
        : { getCookies: () => session.defaultSession.cookies.get({ url: apiBaseUrl }) }),
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
    fetch: fetchApi,
    onChange: (change) => notificationCoordinator.received(change),
    onError: (error) => {
      console.error("Desktop notification stream error", error);
    },
  });

  const updater = electronUpdater.autoUpdater;
  if (runtimeConfig.edition === "local") {
    // Read local-*.yml from the shared GitHub release so the editions never install each other.
    updater.channel = "local";
    // Setting a channel enables downgrades in electron-updater; keep stable-only behavior.
    updater.allowDowngrade = false;
  }
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
        // The local edition keeps Chromium's cookie store closed; see fetchApi.
        const fetchPolicy =
          runtimeConfig.edition === "local"
            ? fetch
            : session.defaultSession.fetch.bind(session.defaultSession);
        const response = await fetchPolicy(desktopUpdatePolicyUrl, {
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
    updater: updater as DesktopUpdater,
    writeCachedPolicy: async (policy: DesktopUpdatePolicy) => {
      await mkdir(app.getPath("userData"), { recursive: true });
      await writeFile(updatePolicyCachePath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
    },
  });

  const ipcHandlers = new IpcHandlerRegistry(ipcMain, (event) =>
    isTrustedMainWindowIpcSender(event, getMainWindow()),
  );
  if (aiCredentialsStore) registerAiCredentialsIpc(ipcHandlers, aiCredentialsStore);
  ipcHandlers
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
    getMainWindowOptions(
      join(__dirname, "..", "preload", "index.cjs"),
      process.platform,
      runtimeConfig.edition,
    ),
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
    runtimeConfig.edition === "cloud" ? flushDefaultSessionCookies() : Promise.resolve(),
  ]);
  await localBackend?.stop();
  localBackend = null;
}

async function startLocalBackend(
  config: Extract<DesktopRuntimeConfig, { edition: "local" }>,
  aiCredentialsStore: AiCredentialsStore,
): Promise<{ baseUrl: string; headers: Record<string, string> }> {
  const sessionToken =
    config.developmentBackend?.sessionToken ?? randomBytes(32).toString("base64url");
  const pdfRenderer = new ElectronPdfRenderer({
    createWindow: (options) => new BrowserWindow(options),
    getSession: (partition) => session.fromPartition(partition),
  });
  localBackend = new LocalBackendProcess({
    modulePath: join(__dirname, "local-backend", "local-backend-utility-process.js"),
    dataDir: join(app.getPath("userData"), "data"),
    sessionToken,
    port: config.developmentBackend?.port ?? 0,
    renderPdf: (html) => pdfRenderer.htmlToPdf(html),
    getAiSelection: () => aiCredentialsStore.currentSelection(),
    onUnexpectedExit: (code) => {
      console.error(`The local backend exited unexpectedly with code ${code}`);
      dialog.showErrorBox(
        `${appIdentity.name} needs to restart`,
        "The local data service stopped unexpectedly. Your data is safe; the app will restart.",
      );
      app.relaunch();
      app.exit(1);
    },
  });

  const { baseUrl } = await localBackend.start();
  return { baseUrl, headers: { [localSessionTokenHeader]: sessionToken } };
}

function withHeaders(init: RequestInit | undefined, headers: Record<string, string>): RequestInit {
  if (Object.keys(headers).length === 0) return init ?? {};
  const merged = new Headers(init?.headers);
  for (const [name, value] of Object.entries(headers)) merged.set(name, value);
  return { ...init, headers: merged };
}

function isAuthCookie(name: string): boolean {
  const normalized = name.replace(/^__(Secure|Host)-/, "");
  return normalized === "session_token" || /(^|[.-])session_token$/.test(normalized);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

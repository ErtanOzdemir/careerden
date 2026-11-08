import {
  app,
  BrowserWindow,
  clipboard,
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
import { createAiProvider } from "@careerden/infrastructure";
import { registerAiCredentialsIpc } from "./ai-credentials/ai-credentials-ipc.js";
import { AiCredentialsStore } from "./ai-credentials/ai-credentials-store.js";
import { AiModelCatalogManager } from "./ai-models/ai-model-catalog-manager.js";
import { getDesktopAppIdentity } from "./desktop-app-identity.js";
import { loadDesktopRuntimeConfig, type DesktopRuntimeConfig } from "./desktop-runtime-config.js";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";
import { isTrustedMainWindowIpcSender } from "./ipc-sender-policy.js";
import { ElectronPdfRenderer } from "./local-backend/electron-pdf-renderer.js";
import { LocalBackendProcess } from "./local-backend/local-backend-process.js";
import { backupFileExtension, registerLocalDataIpc } from "./local-data/local-data-ipc.js";
import { DesktopLogger, resolveDesktopLogsDirectory } from "./logging/desktop-logger.js";
import { registerLogSettingsIpc } from "./logging/log-settings-ipc.js";
import { LogSettingsStore } from "./logging/log-settings-store.js";
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
import { DirectoryLocalDataSnapshots } from "./startup-recovery/local-data-snapshots.js";
import { RestartLoopGuard } from "./startup-recovery/restart-loop-guard.js";
import { formatStartupDiagnostics, redactHomeDir } from "./startup-recovery/startup-diagnostics.js";
import { toStartupFailure, type StartupFailure } from "./startup-recovery/startup-failure.js";
import {
  registerStartupRecoveryIpc,
  StartupRecovery,
} from "./startup-recovery/startup-recovery.js";
import { DesktopUpdateManager, type DesktopUpdater } from "./updates/desktop-update-manager.js";
import type { DesktopUpdatePolicy } from "./updates/desktop-update-policy.js";
import {
  desktopUpdateIpcChannels,
  type DesktopUpdateStatus,
} from "./updates/desktop-update-types.js";
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
const startupRecoveryRoute = "/recovery";

let mainWindow: BrowserWindow | null = null;
let mainWindowReady: Promise<BrowserWindow> | null = null;
let localScrapingWorker: LocalScrapingWorker | null = null;
let utilityScrapingRunner: UtilityProcessLinkedInScrapingRunner | null = null;
let notificationStream: DesktopNotificationStream | null = null;
let nativeNotificationPresenter: NativeNotificationPresenter | null = null;
let desktopUpdateManager: DesktopUpdateManager | null = null;
let localBackend: LocalBackendProcess | null = null;
let localRestartGuard: RestartLoopGuard | null = null;
let startupRecovery: StartupRecovery | null = null;
// The newest migration the running local backend reported, for diagnostics after a crash.
let localLastMigration: string | undefined;
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

// Every desktop process logs here: userData/logs/careerden.log, redacted and rotated.
const logger = new DesktopLogger({
  directory: resolveDesktopLogsDirectory(app.getPath("userData")),
  homeDir: app.getPath("home"),
  mirrorToConsole: !app.isPackaged,
});
const logSettings = new LogSettingsStore(join(app.getPath("userData"), "log-settings.json"));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  logger.info("app.started", {
    version: app.getVersion(),
    edition: runtimeConfig.edition,
    os: process.platform,
    osVersion: process.getSystemVersion(),
    arch: process.arch,
    electron: process.versions.electron ?? null,
    packaged: app.isPackaged,
  });
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
    logger.info("app.quitting");
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

  logger.setLevel(await logSettings.readLevel());
  const { desktopUpdateRepository } = runtimeConfig;
  let aiCredentialsStore: AiCredentialsStore | undefined;
  let aiModelCatalog: AiModelCatalogManager | undefined;
  let apiBaseUrl: string;
  let apiRequestHeaders: Record<string, string> = {};
  // Registered before the local backend starts, so the recovery screen can use them too.
  const ipcHandlers = new IpcHandlerRegistry(ipcMain, (event) =>
    isTrustedMainWindowIpcSender(event, getMainWindow()),
  );
  registerWindowIpc(ipcHandlers);

  if (runtimeConfig.edition === "local") {
    aiCredentialsStore = new AiCredentialsStore(
      join(app.getPath("userData"), "ai-credentials.bin"),
      safeStorage,
    );
    localRestartGuard = new RestartLoopGuard({
      statePath: join(app.getPath("userData"), "local-backend-restarts.json"),
    });
    startupRecovery = createStartupRecovery(localRestartGuard);
    registerStartupRecoveryIpc(ipcHandlers, startupRecovery);
    aiModelCatalog = createAiModelCatalogManager(desktopUpdateRepository);
    await aiModelCatalog.start();
    try {
      const backend = await startLocalBackend(runtimeConfig, aiCredentialsStore, aiModelCatalog);
      apiBaseUrl = backend.baseUrl;
      apiRequestHeaders = backend.headers;
    } catch (error) {
      // Data that cannot be opened stays that way on the next launch, so recover instead of
      // restarting.
      logger.exception("local_backend.start_failed", error);
      await showStartupRecovery(toStartupFailure(error));
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
          logger.exception("renderer_protocol.failed", error);
        },
        rendererDirectory: join(__dirname, "..", "..", "renderer"),
      }),
    );
  }

  configureRendererPermissionPolicy(session.defaultSession);
  if (runtimeConfig.edition === "cloud") registerAuthCookiePersistence();

  const claimedBy = getDesktopScrapingClaimOwner();
  utilityScrapingRunner = new UtilityProcessLinkedInScrapingRunner({
    childLog: logger.forSource("scraper"),
    log: logger.forSource("main"),
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
    log: logger.forSource("main"),
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
          logger.exception("notification.activation_failed", error);
        });
    },
    onError: (error) => {
      logger.exception("notification.native_failed", error);
    },
  });

  const nativeNotificationPermissionRequester = new NativeNotificationPermissionRequester({
    initialize: () => new Notification(),
    isSupported: () => Notification.isSupported(),
    onError: (error) => {
      logger.exception("notification.permission_failed", error);
    },
    platform: process.platform,
  });

  const notificationCoordinator = new DesktopNotificationCoordinator({
    getWindow: () => {
      const window = getMainWindow();
      if (!window) return null;

      return {
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
      logger.exception("notification.stream_failed", error);
    },
  });

  const updater = electronUpdater.autoUpdater;
  if (runtimeConfig.edition === "local") {
    // Read local-*.yml from the shared GitHub release so the editions never install each other.
    updater.channel = "local";
    // Setting a channel enables downgrades in electron-updater; keep stable-only behavior.
    updater.allowDowngrade = false;
  }
  let lastUpdateStatus: DesktopUpdateStatus | undefined;
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
      // Progress updates repeat the same status; log only transitions.
      if (state.status !== lastUpdateStatus) {
        lastUpdateStatus = state.status;
        const fields = {
          status: state.status,
          currentVersion: state.currentVersion,
          availableVersion: state.availableVersion ?? null,
          required: state.required,
        };
        if (state.status === "error") {
          logger.warn("update.failed", { ...fields, errorMessage: state.errorMessage ?? null });
        } else {
          logger.info("update.status", fields);
        }
      }
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

  if (aiCredentialsStore) {
    const catalog = aiModelCatalog;
    registerAiCredentialsIpc(ipcHandlers, aiCredentialsStore, {
      createProvider: (selection) =>
        createAiProvider(catalog ? catalog.withModels(selection) : selection),
    });
  }
  // Only the local edition offers the debug logging setting.
  if (runtimeConfig.edition === "local") registerLogSettingsIpc(ipcHandlers, logSettings, logger);
  if (localBackend) registerLocalDataIpc(ipcHandlers, createLocalDataIpcOptions(localBackend));
  ipcHandlers
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
    );

  await createWindow();
  notificationStream.start();
  await desktopUpdateManager.start();
}

// Window, theme, and link handling that every screen needs, including startup recovery.
function registerWindowIpc(ipcHandlers: IpcHandlerRegistry): void {
  ipcHandlers
    .register("open-external", (_event, url: unknown) => {
      const allowedUrl = getAllowedExternalUrl(url);
      if (!allowedUrl) {
        return;
      }
      void shell.openExternal(allowedUrl);
    })
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
  // Reopening the window while recovering, for example from the macOS dock, shows recovery again.
  const route = startupRecovery?.current ? startupRecoveryRoute : undefined;
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
    loadWindow = window.loadURL(route ? new URL(route, devServerUrl).toString() : devServerUrl);
  } else if (app.isPackaged) {
    loadWindow = window.loadURL(
      route ? new URL(route, packagedRendererUrl).toString() : packagedRendererUrl,
    );
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

// Model ids are read from the default branch rather than a release asset, so they can change
// without a release. Builds without an update repository use the embedded defaults.
function createAiModelCatalogManager(updateRepository: string | undefined): AiModelCatalogManager {
  const cachePath = join(app.getPath("userData"), "ai-models-cache.json");
  const catalogUrl = updateRepository
    ? `https://raw.githubusercontent.com/${updateRepository}/HEAD/apps/desktop/ai-models.json`
    : undefined;

  return new AiModelCatalogManager({
    ...(catalogUrl
      ? {
          fetchCatalog: async () => {
            // The local edition keeps Chromium's cookie store closed, so this uses Node's fetch.
            const response = await fetch(catalogUrl, {
              headers: { Accept: "application/json", "Cache-Control": "no-cache" },
              signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) {
              throw new Error(`AI model catalog request failed with HTTP ${response.status}`);
            }
            return response.json();
          },
        }
      : {}),
    readCachedCatalog: async () => {
      try {
        return JSON.parse(await readFile(cachePath, "utf8")) as unknown;
      } catch (error) {
        if (isNodeErrorWithCode(error, "ENOENT")) return undefined;
        throw error;
      }
    },
    writeCachedCatalog: async (catalog) => {
      await mkdir(app.getPath("userData"), { recursive: true });
      await writeFile(cachePath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    },
  });
}

async function startLocalBackend(
  config: Extract<DesktopRuntimeConfig, { edition: "local" }>,
  aiCredentialsStore: AiCredentialsStore,
  aiModelCatalog: AiModelCatalogManager,
): Promise<{ baseUrl: string; headers: Record<string, string> }> {
  const sessionToken =
    config.developmentBackend?.sessionToken ?? randomBytes(32).toString("base64url");
  logger.registerSecret(sessionToken);
  const pdfRenderer = new ElectronPdfRenderer({
    createWindow: (options) => new BrowserWindow(options),
    getSession: (partition) => session.fromPartition(partition),
  });
  localBackend = new LocalBackendProcess({
    modulePath: join(__dirname, "local-backend", "local-backend-utility-process.js"),
    dataDir: getLocalDataDir(),
    sessionToken,
    appVersion: app.getVersion(),
    backupsDir: join(app.getPath("userData"), "backups"),
    port: config.developmentBackend?.port ?? 0,
    renderPdf: (html) =>
      pdfRenderer.htmlToPdf(html).catch((error: unknown) => {
        logger.exception("pdf.render_failed", error);
        throw error;
      }),
    getAiSelection: async () => {
      const selection = await aiCredentialsStore.currentSelection();
      // Provider errors can echo the key; keep it out of every log line.
      if (selection) logger.registerSecret(selection.apiKey);
      return selection ? aiModelCatalog.withModels(selection) : null;
    },
    log: logger.forSource("main"),
    childLog: logger.forSource("local-backend"),
    onUnexpectedExit: (code) => {
      void handleUnexpectedLocalBackendExit(code);
    },
  });

  const { baseUrl, lastMigration } = await localBackend.start();
  localLastMigration = lastMigration;
  return { baseUrl, headers: { [localSessionTokenHeader]: sessionToken } };
}

// A crash after a successful start usually goes away with a restart. One that keeps happening
// does not, so the third within two minutes shows the recovery screen instead.
async function handleUnexpectedLocalBackendExit(code: number): Promise<void> {
  const { restart, recentExits } = (await localRestartGuard?.recordUnexpectedExit()) ?? {
    restart: false,
    recentExits: 1,
  };
  logger.error("local_backend.recovery", {
    exitCode: code,
    recentExits,
    action: restart ? "restart" : "recovery_screen",
  });
  if (restart) {
    dialog.showErrorBox(
      `${appIdentity.name} needs to restart`,
      "The local data service stopped unexpectedly. Your data is safe; the app will restart.",
    );
    app.relaunch();
    app.exit(1);
    return;
  }

  localScrapingWorker?.stop();
  await notificationStream?.stop();
  await showStartupRecovery({
    reason: "crash-loop",
    message: `The local data service stopped unexpectedly ${recentExits} times in a row (exit code ${code}).`,
    ...(localLastMigration ? { lastMigration: localLastMigration } : {}),
  });
}

// Shows the recovery route in the main window. The backend is not running, so the packaged
// protocol serves the renderer without proxying any API request.
async function showStartupRecovery(failure: StartupFailure): Promise<void> {
  const canRoute =
    app.isPackaged ||
    (process.env.NODE_ENV === "development" && Boolean(process.env.VITE_DEV_SERVER_URL));
  if (!startupRecovery || !canRoute) {
    // An unpackaged production renderer loads from a file and has no recovery route.
    dialog.showErrorBox(
      `${appIdentity.name} could not start`,
      `Your local data could not be opened. ${failure.message}`,
    );
    app.exit(1);
    return;
  }

  logger.warn("startup_recovery.shown", {
    reason: failure.reason,
    lastMigration: failure.lastMigration ?? null,
  });
  startupRecovery.enter(failure);
  if (
    app.isPackaged &&
    !session.defaultSession.protocol.isProtocolHandled(packagedRendererScheme)
  ) {
    session.defaultSession.protocol.handle(
      packagedRendererScheme,
      createPackagedRendererProtocolHandler({
        fetchApi: (input, init) => fetch(input, init),
        fetchFile: (input, init) => net.fetch(input, init),
        onError: (error) => {
          logger.exception("renderer_protocol.failed", error);
        },
        rendererDirectory: join(__dirname, "..", "..", "renderer"),
      }),
    );
  }
  configureRendererPermissionPolicy(session.defaultSession);

  const existingWindow = getMainWindow();
  if (existingWindow) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    const base = app.isPackaged || !devServerUrl ? packagedRendererUrl : devServerUrl;
    await existingWindow.loadURL(new URL(startupRecoveryRoute, base).toString());
  }
  await activateMainWindow();
}

function createStartupRecovery(restartGuard: RestartLoopGuard): StartupRecovery {
  const userData = app.getPath("userData");
  const homeDir = app.getPath("home");
  return new StartupRecovery({
    snapshots: new DirectoryLocalDataSnapshots({
      backupsDir: join(userData, "backups"),
      dataDir: getLocalDataDir(),
    }),
    appVersion: app.getVersion(),
    formatDiagnostics: (failure) =>
      formatStartupDiagnostics({
        failure,
        appName: appIdentity.name,
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron ?? "unknown",
        platform: process.platform,
        osVersion: process.getSystemVersion(),
        arch: process.arch,
        lastMigration: localLastMigration,
        homeDir,
        now: new Date(),
      }),
    redact: (text) => redactHomeDir(text, homeDir),
    writeClipboard: (text) => clipboard.writeText(text),
    openDataFolder: async () => {
      const dataDir = getLocalDataDir();
      if (existsSync(dataDir)) shell.showItemInFolder(dataDir);
      else await shell.openPath(userData);
    },
    restart: async () => {
      await restartGuard.reset();
      app.relaunch();
      app.exit(0);
    },
    quit: () => app.quit(),
  });
}

function getLocalDataDir(): string {
  return join(app.getPath("userData"), "data");
}

// Backups never include ai-credentials.bin: it sits beside the data folder, not inside it, and
// its keychain-bound encryption would not open on another device anyway.
function createLocalDataIpcOptions(backend: LocalBackendProcess) {
  const backupFilters = [{ name: "Careerden backup", extensions: [backupFileExtension] }];
  return {
    backend,
    appVersion: app.getVersion(),
    snapshotsDir: join(app.getPath("userData"), "backups"),
    chooseExportPath: async (defaultFileName: string) => {
      const options: Electron.SaveDialogOptions = {
        title: "Export data",
        defaultPath: join(app.getPath("documents"), defaultFileName),
        filters: backupFilters,
      };
      const window = getMainWindow();
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options);
      return result.canceled ? undefined : result.filePath;
    },
    chooseImportPath: async () => {
      const options: Electron.OpenDialogOptions = {
        title: "Import from backup",
        properties: ["openFile"],
        filters: backupFilters,
      };
      const window = getMainWindow();
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      return result.canceled ? undefined : result.filePaths[0];
    },
    // Reveals the data folder beside the automatic pre-import snapshots in "backups".
    openDataFolder: async () => shell.showItemInFolder(getLocalDataDir()),
  };
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

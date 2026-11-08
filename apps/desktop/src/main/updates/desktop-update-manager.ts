import type { DesktopUpdatePolicy } from "./desktop-update-policy.js";
import { isDesktopUpdateRequired, parseDesktopUpdatePolicy } from "./desktop-update-policy.js";
import type { DesktopUpdateState } from "./desktop-update-types.js";

const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1_000;

interface DesktopUpdaterEventMap {
  "checking-for-update": () => void;
  "download-progress": (progress: { percent: number }) => void;
  error: (error: Error) => void;
  "update-available": (info: { version: string }) => void;
  "update-downloaded": (info: { version: string }) => void;
  "update-not-available": () => void;
}

export interface DesktopUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown>;
  on<Event extends keyof DesktopUpdaterEventMap>(
    event: Event,
    listener: DesktopUpdaterEventMap[Event],
  ): this;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
}

export interface DesktopUpdateManagerDependencies {
  beforeInstall: () => Promise<void>;
  currentVersion: string;
  fetchPolicy: () => Promise<unknown>;
  isPackaged: boolean;
  now?: () => Date;
  onStateChange?: (state: DesktopUpdateState) => void;
  readCachedPolicy: () => Promise<unknown | undefined>;
  setInterval?: (callback: () => void, delayMs: number) => ReturnType<typeof setInterval>;
  updater: DesktopUpdater;
  writeCachedPolicy: (policy: DesktopUpdatePolicy) => Promise<void>;
}

export class DesktopUpdateManager {
  private readonly beforeInstall: () => Promise<void>;
  private readonly currentVersion: string;
  private readonly fetchPolicy: () => Promise<unknown>;
  private readonly isPackaged: boolean;
  private readonly now: () => Date;
  private readonly onStateChange: (state: DesktopUpdateState) => void;
  private readonly readCachedPolicy: () => Promise<unknown | undefined>;
  private readonly scheduleInterval: NonNullable<DesktopUpdateManagerDependencies["setInterval"]>;
  private readonly updater: DesktopUpdater;
  private readonly writeCachedPolicy: (policy: DesktopUpdatePolicy) => Promise<void>;
  private policy: DesktopUpdatePolicy | undefined;
  private checkPromise: Promise<void> | undefined;
  private state: DesktopUpdateState;
  private lastCheckedAt: Date | undefined;

  constructor(dependencies: DesktopUpdateManagerDependencies) {
    this.beforeInstall = dependencies.beforeInstall;
    this.currentVersion = dependencies.currentVersion;
    this.fetchPolicy = dependencies.fetchPolicy;
    this.isPackaged = dependencies.isPackaged;
    this.now = dependencies.now ?? (() => new Date());
    this.onStateChange = dependencies.onStateChange ?? (() => undefined);
    this.readCachedPolicy = dependencies.readCachedPolicy;
    this.scheduleInterval = dependencies.setInterval ?? setInterval;
    this.updater = dependencies.updater;
    this.writeCachedPolicy = dependencies.writeCachedPolicy;
    this.state = {
      currentVersion: this.currentVersion,
      required: false,
      status: this.isPackaged ? "idle" : "disabled",
    };

    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = true;
    this.registerUpdaterEvents();
  }

  async start(): Promise<void> {
    if (!this.isPackaged) {
      this.publishState();
      return;
    }

    await this.loadCachedPolicy();
    void this.checkForUpdates();
    this.scheduleInterval(() => {
      void this.checkForUpdates();
    }, DEFAULT_CHECK_INTERVAL_MS);
  }

  getState(): DesktopUpdateState {
    return { ...this.state };
  }

  // When the last update check finished, successfully or not; undefined before the first one.
  getLastCheckedAt(): Date | undefined {
    return this.lastCheckedAt;
  }

  checkForUpdates(): Promise<void> {
    if (!this.isPackaged) return Promise.resolve();
    if (this.checkPromise) return this.checkPromise;

    this.setState({ errorMessage: undefined, status: "checking" });
    this.checkPromise = Promise.allSettled([this.refreshPolicy(), this.updater.checkForUpdates()])
      .then((results) => {
        this.lastCheckedAt = this.now();
        const updaterResult = results[1];
        if (updaterResult.status === "rejected") {
          this.handleUpdaterError(updaterResult.reason);
        }
      })
      .finally(() => {
        this.checkPromise = undefined;
      });

    return this.checkPromise;
  }

  async restartAndInstall(): Promise<void> {
    if (this.state.status !== "ready") return;

    await this.beforeInstall();
    this.updater.quitAndInstall(false, true);
  }

  private registerUpdaterEvents(): void {
    this.updater
      .on("checking-for-update", () => {
        this.setState({ errorMessage: undefined, status: "checking" });
      })
      .on("update-available", (info) => {
        this.setState({
          availableVersion: info.version,
          errorMessage: undefined,
          status: "available",
        });
      })
      .on("update-not-available", () => {
        this.setState({
          availableVersion: undefined,
          downloadPercent: undefined,
          errorMessage: undefined,
          status: "up-to-date",
        });
      })
      .on("download-progress", (progress) => {
        this.setState({
          downloadPercent: clampPercentage(progress.percent),
          errorMessage: undefined,
          status: "downloading",
        });
      })
      .on("update-downloaded", (info) => {
        this.setState({
          availableVersion: info.version,
          downloadPercent: 100,
          errorMessage: undefined,
          status: "ready",
        });
      })
      .on("error", (error) => {
        this.handleUpdaterError(error);
      });
  }

  private async loadCachedPolicy(): Promise<void> {
    try {
      const cached = await this.readCachedPolicy();
      if (cached === undefined) return;
      this.applyPolicy(parseDesktopUpdatePolicy(cached));
    } catch (error) {
      console.warn("Ignoring invalid desktop update policy cache", error);
    }
  }

  private async refreshPolicy(): Promise<void> {
    try {
      const policy = parseDesktopUpdatePolicy(await this.fetchPolicy());
      this.applyPolicy(policy);
      await this.writeCachedPolicy(policy);
    } catch (error) {
      console.warn("Could not refresh desktop update policy; using the cached policy", error);
    }
  }

  private applyPolicy(policy: DesktopUpdatePolicy): void {
    this.policy = policy;
    this.setState({
      minimumSupportedVersion: policy.minimumSupportedVersion,
      required: isDesktopUpdateRequired(this.currentVersion, policy),
    });
  }

  private handleUpdaterError(error: unknown): void {
    const message = error instanceof Error ? error.message : "The update check failed.";
    this.setState({
      errorMessage: message,
      status: "error",
    });
  }

  private setState(patch: Partial<DesktopUpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: this.currentVersion,
      required: isDesktopUpdateRequired(this.currentVersion, this.policy),
    };
    this.publishState();
  }

  private publishState(): void {
    this.onStateChange(this.getState());
  }
}

function clampPercentage(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)));
}

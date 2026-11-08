import { z } from "zod";
import {
  LocalDataRestoreError,
  type LocalDataSnapshot,
  type LocalDataSnapshotSource,
} from "./local-data-snapshots.js";
import type { StartupFailure, StartupFailureReason } from "./startup-failure.js";

export const startupRecoveryIpcChannels = {
  getState: "startup-recovery-get-state",
  restore: "startup-recovery-restore",
  openDataFolder: "startup-recovery-open-data-folder",
  copyDiagnostics: "startup-recovery-copy-diagnostics",
  quit: "startup-recovery-quit",
} as const;

// What the recovery screen shows. It names snapshots by id but never by path.
export interface StartupRecoveryState {
  reason: StartupFailureReason;
  message: string;
  appVersion: string;
  snapshots: LocalDataSnapshot[];
}

export type StartupRecoveryRestoreResult =
  | { status: "restored" }
  | { status: "error"; message: string };

export interface StartupRecoveryOptions {
  snapshots: LocalDataSnapshotSource;
  appVersion: string;
  // The same Markdown summary Settings copies, with the startup failure added.
  formatDiagnostics: (failure: StartupFailure) => Promise<string>;
  // Strips local paths from what the renderer sees.
  redact: (text: string) => string;
  writeClipboard: (text: string) => void;
  openDataFolder: () => Promise<void>;
  // Relaunches the app so it opens the restored data.
  restart: () => Promise<void> | void;
  quit: () => void;
}

interface IpcRegistrar {
  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): unknown;
}

const snapshotIdSchema = z.string().min(1).max(200);

// Local edition only. Holds the failure that stopped the local backend from starting and the
// actions the recovery screen offers. Every action but reading the state requires an active
// failure, so the renderer cannot replace the data folder while the backend is running.
export class StartupRecovery {
  private failure: StartupFailure | undefined;
  private restoring = false;

  constructor(private readonly options: StartupRecoveryOptions) {}

  enter(failure: StartupFailure): void {
    this.failure = failure;
  }

  get current(): StartupFailure | undefined {
    return this.failure;
  }

  async getState(): Promise<StartupRecoveryState | null> {
    const failure = this.failure;
    if (!failure) return null;
    const snapshots = await this.options.snapshots.list().catch((error: unknown) => {
      console.error("Could not list local data snapshots", error);
      return [];
    });
    return {
      reason: failure.reason,
      message: this.options.redact(failure.message).slice(0, 500),
      appVersion: this.options.appVersion,
      snapshots,
    };
  }

  async restore(id: unknown): Promise<StartupRecoveryRestoreResult> {
    this.requireActive();
    const snapshotId = snapshotIdSchema.parse(id);
    if (this.restoring) return { status: "error", message: "A restore is already running." };
    this.restoring = true;
    try {
      await this.options.snapshots.restore(snapshotId);
    } catch (error) {
      if (!(error instanceof LocalDataRestoreError)) {
        console.error("Could not restore local data", error);
      }
      return {
        status: "error",
        message:
          error instanceof LocalDataRestoreError
            ? error.message
            : "The backup could not be restored.",
      };
    } finally {
      this.restoring = false;
    }
    await this.options.restart();
    return { status: "restored" };
  }

  async openDataFolder(): Promise<void> {
    this.requireActive();
    await this.options.openDataFolder();
  }

  // Copies the diagnostics in the main process. The summary includes log lines, so it goes to the
  // clipboard only and is not returned to the renderer.
  async copyDiagnostics(): Promise<void> {
    const failure = this.requireActive();
    this.options.writeClipboard(await this.options.formatDiagnostics(failure));
  }

  quit(): void {
    this.requireActive();
    this.options.quit();
  }

  private requireActive(): StartupFailure {
    if (!this.failure) throw new Error("Startup recovery is not active");
    return this.failure;
  }
}

export function registerStartupRecoveryIpc(
  registry: IpcRegistrar,
  recovery: StartupRecovery,
): void {
  registry.register(startupRecoveryIpcChannels.getState, () => recovery.getState());
  registry.register(startupRecoveryIpcChannels.restore, (_event, id) => recovery.restore(id));
  registry.register(startupRecoveryIpcChannels.openDataFolder, () => recovery.openDataFolder());
  registry.register(startupRecoveryIpcChannels.copyDiagnostics, () => recovery.copyDiagnostics());
  registry.register(startupRecoveryIpcChannels.quit, () => recovery.quit());
}

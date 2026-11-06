import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { IpcHandlerRegistry } from "../ipc-handlers-registry.js";
import { isTrustedMainWindowIpcSender } from "../ipc-sender-policy.js";
import { LocalDataRestoreError, type LocalDataSnapshotSource } from "./local-data-snapshots.js";
import { formatStartupDiagnostics } from "./startup-diagnostics.js";
import {
  StartupRecovery,
  registerStartupRecoveryIpc,
  startupRecoveryIpcChannels,
  type StartupRecoveryOptions,
} from "./startup-recovery.js";

const snapshot = {
  id: "before-migration-2026-11-05T09-15-00Z",
  kind: "before-migration",
  createdAt: "2026-11-05T09:15:00.000Z",
};

const migrationFailure = {
  reason: "migration" as const,
  message: "A database update failed: /Users/ada/Library/data/pglite is busy",
  lastMigration: "20261012000000_auth_rate_limits.cjs",
};

function createRecovery(overrides: Partial<StartupRecoveryOptions> = {}) {
  const snapshots: LocalDataSnapshotSource = {
    list: vi.fn(async () => [snapshot]),
    restore: vi.fn(async () => undefined),
  };
  const options = {
    snapshots,
    appVersion: "0.7.0",
    formatDiagnostics: vi.fn(() => "diagnostics"),
    redact: (text: string) => text.split("/Users/ada").join("~"),
    writeClipboard: vi.fn(),
    openDataFolder: vi.fn(async () => undefined),
    restart: vi.fn(),
    quit: vi.fn(),
    ...overrides,
  };
  return { recovery: new StartupRecovery(options), options };
}

// Registers the channels behind the same sender policy as the app: the main window's main frame.
function registerThroughSenderPolicy(recovery: StartupRecovery) {
  const mainFrame = {};
  const webContents = { mainFrame };
  const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow;
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const registry = new IpcHandlerRegistry(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    (event) => isTrustedMainWindowIpcSender(event, window),
  );
  registerStartupRecoveryIpc(registry, recovery);

  const invoke = (sender: object, frame: object, channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({ sender, senderFrame: frame } as IpcMainInvokeEvent, ...args);
  return {
    fromMainFrame: (channel: string, ...args: unknown[]) =>
      invoke(webContents, mainFrame, channel, ...args),
    fromSubframe: (channel: string, ...args: unknown[]) =>
      invoke(webContents, {}, channel, ...args),
    channels: [...handlers.keys()],
  };
}

describe("StartupRecovery", () => {
  it("has no state and refuses every action until startup fails", async () => {
    const { recovery, options } = createRecovery();

    await expect(recovery.getState()).resolves.toBeNull();
    await expect(recovery.restore(snapshot.id)).rejects.toThrow("not active");
    expect(() => recovery.copyDiagnostics()).toThrow("not active");
    expect(() => recovery.quit()).toThrow("not active");
    expect(options.snapshots.restore).not.toHaveBeenCalled();
  });

  it("describes the failure and the available snapshots without local paths", async () => {
    const { recovery } = createRecovery();
    recovery.enter(migrationFailure);

    await expect(recovery.getState()).resolves.toEqual({
      reason: "migration",
      message: "A database update failed: ~/Library/data/pglite is busy",
      appVersion: "0.7.0",
      snapshots: [snapshot],
    });
  });

  it("shows an empty snapshot list when the backups folder cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { recovery } = createRecovery({
      snapshots: {
        list: async () => {
          throw new Error("EACCES");
        },
        restore: async () => undefined,
      },
    });
    recovery.enter(migrationFailure);

    await expect(recovery.getState()).resolves.toMatchObject({ snapshots: [] });
    vi.restoreAllMocks();
  });

  it("restarts the app after a restore succeeds", async () => {
    const { recovery, options } = createRecovery();
    recovery.enter(migrationFailure);

    await expect(recovery.restore(snapshot.id)).resolves.toEqual({ status: "restored" });
    expect(options.snapshots.restore).toHaveBeenCalledWith(snapshot.id);
    expect(options.restart).toHaveBeenCalledOnce();
  });

  it("stays on the recovery screen when a restore fails", async () => {
    const { recovery, options } = createRecovery({
      snapshots: {
        list: async () => [snapshot],
        restore: async () => {
          throw new LocalDataRestoreError("That backup is no longer available.");
        },
      },
    });
    recovery.enter(migrationFailure);

    await expect(recovery.restore(snapshot.id)).resolves.toEqual({
      status: "error",
      message: "That backup is no longer available.",
    });
    await expect(recovery.restore(42)).rejects.toThrow();
    expect(options.restart).not.toHaveBeenCalled();
  });

  it("copies the diagnostics from the main process", () => {
    const { recovery, options } = createRecovery();
    recovery.enter(migrationFailure);

    expect(recovery.copyDiagnostics()).toBe("diagnostics");
    expect(options.formatDiagnostics).toHaveBeenCalledWith(migrationFailure);
    expect(options.writeClipboard).toHaveBeenCalledWith("diagnostics");
  });
});

describe("registerStartupRecoveryIpc", () => {
  it("serves every channel to the main window's main frame only", async () => {
    const { recovery, options } = createRecovery();
    recovery.enter(migrationFailure);
    const ipc = registerThroughSenderPolicy(recovery);

    expect(ipc.channels.sort()).toEqual(Object.values(startupRecoveryIpcChannels).sort());
    for (const channel of ipc.channels) {
      expect(() => ipc.fromSubframe(channel, snapshot.id)).toThrow("IPC sender is not trusted");
    }
    expect(options.snapshots.restore).not.toHaveBeenCalled();
    expect(options.quit).not.toHaveBeenCalled();

    await expect(ipc.fromMainFrame(startupRecoveryIpcChannels.getState)).resolves.toMatchObject({
      reason: "migration",
    });
    await expect(
      ipc.fromMainFrame(startupRecoveryIpcChannels.restore, snapshot.id),
    ).resolves.toEqual({ status: "restored" });
    await ipc.fromMainFrame(startupRecoveryIpcChannels.openDataFolder);
    expect(options.openDataFolder).toHaveBeenCalledOnce();
    ipc.fromMainFrame(startupRecoveryIpcChannels.quit);
    expect(options.quit).toHaveBeenCalledOnce();
  });
});

describe("formatStartupDiagnostics", () => {
  const base = {
    appName: "Careerden Unplugged",
    appVersion: "0.7.0",
    electronVersion: "43.1.0",
    platform: "darwin" as const,
    osVersion: "26.0",
    arch: "arm64",
    homeDir: "/Users/ada",
    now: new Date("2026-11-06T10:00:00.000Z"),
  };

  it("lists the error, app version, last migration, and OS without the home folder", () => {
    expect(formatStartupDiagnostics({ ...base, failure: migrationFailure })).toBe(
      [
        "Careerden Unplugged startup diagnostics",
        "Time: 2026-11-06T10:00:00.000Z",
        "App version: 0.7.0",
        "Electron: 43.1.0",
        "OS: darwin 26.0 (arm64)",
        "Problem: A database update failed (migration)",
        "Error: A database update failed: ~/Library/data/pglite is busy",
        "Last migration: 20261012000000_auth_rate_limits.cjs",
        "",
      ].join("\n"),
    );
  });

  it("names the migrations a newer version applied and falls back to the running schema", () => {
    const text = formatStartupDiagnostics({
      ...base,
      lastMigration: "20261031000000_profile_onboarding_state.cjs",
      failure: { reason: "crash-loop", message: "Stopped 3 times" },
    });
    expect(text).toContain("Last migration: 20261031000000_profile_onboarding_state.cjs");

    expect(
      formatStartupDiagnostics({
        ...base,
        failure: {
          reason: "newer-version",
          message: "This data was created by a newer version of Careerden.",
          unknownMigrations: ["29990101000000_future.cjs"],
        },
      }),
    ).toContain("Migrations from a newer version: 29990101000000_future.cjs");
  });
});

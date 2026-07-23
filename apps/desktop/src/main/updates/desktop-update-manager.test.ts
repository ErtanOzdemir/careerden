import { describe, expect, it, vi } from "vitest";
import { DesktopUpdateManager, type DesktopUpdater } from "./desktop-update-manager.js";
import type { DesktopUpdateState } from "./desktop-update-types.js";

describe("DesktopUpdateManager", () => {
  it("loads a cached mandatory policy before a remote check completes", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockImplementation(() => new Promise(() => undefined));
    const states: DesktopUpdateState[] = [];
    const manager = new DesktopUpdateManager({
      beforeInstall: vi.fn(),
      currentVersion: "0.1.6",
      fetchPolicy: vi.fn(() => new Promise(() => undefined)),
      isPackaged: true,
      onStateChange: (state) => states.push(state),
      readCachedPolicy: vi.fn().mockResolvedValue(createPolicy("0.2.0")),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy: vi.fn(),
    });

    await manager.start();

    expect(manager.getState()).toMatchObject({
      currentVersion: "0.1.6",
      minimumSupportedVersion: "0.2.0",
      required: true,
    });
    expect(states.some((state) => state.required)).toBe(true);
  });

  it("accepts a fresh lower minimum version as an emergency rollback", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockResolvedValue(undefined);
    const writeCachedPolicy = vi.fn();
    const manager = new DesktopUpdateManager({
      beforeInstall: vi.fn(),
      currentVersion: "0.1.6",
      fetchPolicy: vi.fn().mockResolvedValue(createPolicy("0.1.0")),
      isPackaged: true,
      readCachedPolicy: vi.fn().mockResolvedValue(createPolicy("0.2.0")),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy,
    });

    await manager.start();
    await manager.checkForUpdates();

    expect(manager.getState()).toMatchObject({
      minimumSupportedVersion: "0.1.0",
      required: false,
    });
    expect(writeCachedPolicy).toHaveBeenCalledWith(createPolicy("0.1.0"));
  });

  it("fails open without a cached mandatory policy when GitHub is unavailable", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error("private repository"));
    const manager = new DesktopUpdateManager({
      beforeInstall: vi.fn(),
      currentVersion: "0.1.6",
      fetchPolicy: vi.fn().mockRejectedValue(new Error("not found")),
      isPackaged: true,
      readCachedPolicy: vi.fn().mockResolvedValue(undefined),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy: vi.fn(),
    });

    await manager.start();
    await manager.checkForUpdates();

    expect(manager.getState()).toMatchObject({
      required: false,
      status: "error",
    });
  });

  it("keeps a cached mandatory policy enforced when refreshes fail", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error("offline"));
    const manager = new DesktopUpdateManager({
      beforeInstall: vi.fn(),
      currentVersion: "0.1.6",
      fetchPolicy: vi.fn().mockRejectedValue(new Error("offline")),
      isPackaged: true,
      readCachedPolicy: vi.fn().mockResolvedValue(createPolicy("0.2.0")),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy: vi.fn(),
    });

    await manager.start();
    await manager.checkForUpdates();

    expect(manager.getState()).toMatchObject({
      minimumSupportedVersion: "0.2.0",
      required: true,
      status: "error",
    });
  });

  it("shuts down runtime services before installing a downloaded update", async () => {
    const updater = createUpdater();
    const beforeInstall = vi.fn().mockResolvedValue(undefined);
    const manager = new DesktopUpdateManager({
      beforeInstall,
      currentVersion: "0.1.6",
      fetchPolicy: vi.fn(),
      isPackaged: true,
      readCachedPolicy: vi.fn(),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy: vi.fn(),
    });

    updater.emit("update-downloaded", { version: "0.1.7" });
    await manager.restartAndInstall();

    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("does not contact update services in an unpackaged development build", async () => {
    const updater = createUpdater();
    const fetchPolicy = vi.fn();
    const manager = new DesktopUpdateManager({
      beforeInstall: vi.fn(),
      currentVersion: "0.1.6",
      fetchPolicy,
      isPackaged: false,
      readCachedPolicy: vi.fn(),
      setInterval: vi.fn() as never,
      updater,
      writeCachedPolicy: vi.fn(),
    });

    await manager.start();
    await manager.checkForUpdates();

    expect(manager.getState().status).toBe("disabled");
    expect(fetchPolicy).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});

function createPolicy(minimumSupportedVersion: string) {
  return { schemaVersion: 1, minimumSupportedVersion };
}

function createUpdater() {
  const listeners = new Map<string, (...args: never[]) => void>();
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(),
    emit(event: string, value: unknown) {
      listeners.get(event)?.(value as never);
    },
    on: vi.fn((event: string, listener: (...args: never[]) => void) => {
      listeners.set(event, listener);
      return updater;
    }),
    quitAndInstall: vi.fn(),
  } satisfies DesktopUpdater & {
    checkForUpdates: ReturnType<typeof vi.fn>;
    emit: (event: string, value: unknown) => void;
    quitAndInstall: ReturnType<typeof vi.fn>;
  };
  return updater;
}

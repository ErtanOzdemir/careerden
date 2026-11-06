import { describe, expect, it, vi } from "vitest";
import type { LocalBackupSummary } from "../local-backend/local-backend-messages.js";
import {
  localDataIpcChannels,
  registerLocalDataIpc,
  type LocalDataIpcOptions,
} from "./local-data-ipc.js";

const summary: LocalBackupSummary = {
  createdAt: "2026-11-06T10:00:00.000Z",
  appVersion: "0.7.0",
  applications: 3,
  files: 2,
};

class FakeRegistry {
  readonly handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) {
    this.handlers.set(channel, handler);
    return this;
  }

  invoke(channel: string) {
    return this.handlers.get(channel)?.({});
  }
}

function setup(overrides: Partial<LocalDataIpcOptions> = {}) {
  const registry = new FakeRegistry();
  const options: LocalDataIpcOptions = {
    backend: {
      exportBackup: vi.fn(async () => summary),
      importBackup: vi.fn(async () => summary),
    },
    appVersion: "0.7.0",
    snapshotsDir: "/user-data/backups",
    chooseExportPath: vi.fn(async (name: string) => `/Users/ada/Documents/${name}`),
    chooseImportPath: vi.fn(async () => "/Users/ada/Downloads/backup.zip"),
    openDataFolder: vi.fn(async () => undefined),
    now: () => new Date("2026-11-06T10:15:30.123Z"),
    ...overrides,
  };
  registerLocalDataIpc(registry, options);
  return { registry, options };
}

describe("registerLocalDataIpc", () => {
  it("exports to the path chosen in the save dialog and returns only its file name", async () => {
    const { registry, options } = setup();

    await expect(registry.invoke(localDataIpcChannels.export)).resolves.toEqual({
      status: "exported",
      fileName: "careerden-unplugged-backup-2026-11-06.zip",
      summary,
    });
    expect(options.chooseExportPath).toHaveBeenCalledWith(
      "careerden-unplugged-backup-2026-11-06.zip",
    );
    expect(options.backend.exportBackup).toHaveBeenCalledWith(
      "/Users/ada/Documents/careerden-unplugged-backup-2026-11-06.zip",
      "0.7.0",
    );
  });

  it("does nothing when a dialog is canceled", async () => {
    const { registry, options } = setup({
      chooseExportPath: vi.fn(async () => undefined),
      chooseImportPath: vi.fn(async () => undefined),
    });

    await expect(registry.invoke(localDataIpcChannels.export)).resolves.toEqual({
      status: "canceled",
    });
    await expect(registry.invoke(localDataIpcChannels.import)).resolves.toEqual({
      status: "canceled",
    });
    expect(options.backend.exportBackup).not.toHaveBeenCalled();
    expect(options.backend.importBackup).not.toHaveBeenCalled();
  });

  it("imports the chosen archive after snapshotting into the backups folder", async () => {
    const { registry, options } = setup();

    await expect(registry.invoke(localDataIpcChannels.import)).resolves.toEqual({
      status: "imported",
      snapshotFileName: "before-import-2026-11-06T10-15-30Z.zip",
      summary,
    });
    expect(options.backend.importBackup).toHaveBeenCalledWith(
      "/Users/ada/Downloads/backup.zip",
      "/user-data/backups/before-import-2026-11-06T10-15-30Z.zip",
      "0.7.0",
    );
  });

  it("reports a rejected archive as a result instead of an IPC error", async () => {
    const { registry } = setup({
      backend: {
        exportBackup: vi.fn(async () => summary),
        importBackup: vi.fn(async () => {
          throw new Error("This backup was made by a newer version of Careerden Unplugged.");
        }),
      },
    });

    await expect(registry.invoke(localDataIpcChannels.import)).resolves.toEqual({
      status: "error",
      message: "This backup was made by a newer version of Careerden Unplugged.",
    });
  });

  it("refuses to start a second backup while one is running", async () => {
    let finish!: (value: LocalBackupSummary) => void;
    const { registry } = setup({
      backend: {
        exportBackup: vi.fn(() => new Promise<LocalBackupSummary>((resolve) => (finish = resolve))),
        importBackup: vi.fn(async () => summary),
      },
    });

    const first = registry.invoke(localDataIpcChannels.export);
    await vi.waitFor(() => expect(finish).toBeDefined());
    await expect(registry.invoke(localDataIpcChannels.import)).resolves.toEqual({
      status: "error",
      message: "Another export or import is still running.",
    });
    finish(summary);
    await expect(first).resolves.toMatchObject({ status: "exported" });
  });

  it("opens the data folder", async () => {
    const { registry, options } = setup();

    await registry.invoke(localDataIpcChannels.openFolder);

    expect(options.openDataFolder).toHaveBeenCalledOnce();
  });
});

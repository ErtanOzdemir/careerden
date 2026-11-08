import { basename, join } from "node:path";
import type { LocalBackupSummary } from "../local-backend/local-backend-messages.js";

export const localDataIpcChannels = {
  export: "local-data-export",
  import: "local-data-import",
  openFolder: "local-data-open-folder",
} as const;

// Backups are zip archives under their own extension, so a file manager doesn't offer to unpack
// them and the import dialog lists only Careerden backups.
export const backupFileExtension = "careerden";

// Results name files but never return a full path to the renderer.
export type LocalDataExportResult =
  | { status: "canceled" }
  | { status: "exported"; fileName: string; summary: LocalBackupSummary }
  | { status: "error"; message: string };

export type LocalDataImportResult =
  | { status: "canceled" }
  | { status: "imported"; snapshotFileName: string; summary: LocalBackupSummary }
  | { status: "error"; message: string };

export interface LocalDataBackend {
  exportBackup(outputPath: string, appVersion: string): Promise<LocalBackupSummary>;
  importBackup(
    archivePath: string,
    snapshotPath: string,
    appVersion: string,
  ): Promise<LocalBackupSummary>;
}

export interface LocalDataIpcOptions {
  backend: LocalDataBackend;
  appVersion: string;
  // Folder for the automatic snapshots taken before an import.
  snapshotsDir: string;
  // Native dialogs, owned by the main process. Each resolves undefined when canceled.
  chooseExportPath: (defaultFileName: string) => Promise<string | undefined>;
  chooseImportPath: () => Promise<string | undefined>;
  openDataFolder: () => Promise<void>;
  now?: () => Date;
}

interface IpcRegistrar {
  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): unknown;
}

// Local edition only. The renderer passes no arguments: the main process asks the user for every
// path through native dialogs, so a renderer can neither read nor write a file it chooses.
export function registerLocalDataIpc(registry: IpcRegistrar, options: LocalDataIpcOptions): void {
  const now = options.now ?? (() => new Date());
  let busy = false;
  const exclusive = async <T>(work: () => Promise<T>): Promise<T | LocalDataBusy> => {
    if (busy) return busyResult;
    busy = true;
    try {
      return await work();
    } finally {
      busy = false;
    }
  };

  registry.register(localDataIpcChannels.export, () =>
    exclusive(async (): Promise<LocalDataExportResult> => {
      const outputPath = await options.chooseExportPath(
        `careerden-unplugged-backup-${fileDate(now())}.${backupFileExtension}`,
      );
      if (!outputPath) return { status: "canceled" };
      try {
        const summary = await options.backend.exportBackup(outputPath, options.appVersion);
        return { status: "exported", fileName: basename(outputPath), summary };
      } catch (error) {
        return { status: "error", message: errorMessage(error) };
      }
    }),
  );

  registry.register(localDataIpcChannels.import, () =>
    exclusive(async (): Promise<LocalDataImportResult> => {
      const archivePath = await options.chooseImportPath();
      if (!archivePath) return { status: "canceled" };
      const snapshotPath = join(
        options.snapshotsDir,
        `before-import-${fileTimestamp(now())}.${backupFileExtension}`,
      );
      try {
        const summary = await options.backend.importBackup(
          archivePath,
          snapshotPath,
          options.appVersion,
        );
        return { status: "imported", snapshotFileName: basename(snapshotPath), summary };
      } catch (error) {
        return { status: "error", message: errorMessage(error) };
      }
    }),
  );

  registry.register(localDataIpcChannels.openFolder, () => options.openDataFolder());
}

type LocalDataBusy = { status: "error"; message: string };
const busyResult: LocalDataBusy = {
  status: "error",
  message: "Another export or import is still running.",
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message.slice(0, 500)
    : "Something went wrong.";
}

function fileDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Sortable and valid in file names on every platform.
function fileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

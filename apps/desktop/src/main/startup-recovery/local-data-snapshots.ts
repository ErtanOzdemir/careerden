import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// A saved copy of the local data that the recovery screen can restore. Ids are file names inside
// the backups folder, never paths, so the renderer can only pick one from the list.
export interface LocalDataSnapshot {
  id: string;
  // What took the snapshot, for example "before-migration" or "before-import".
  kind: string;
  createdAt: string;
}

// One storage format for snapshots. Restoring replaces the data folder and requires the local
// backend to be stopped; the app relaunches afterwards to open the restored data.
export interface LocalDataSnapshotSource {
  list(): Promise<LocalDataSnapshot[]>;
  restore(id: string): Promise<void>;
}

// Carries a message written for the user.
export class LocalDataRestoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LocalDataRestoreError";
  }
}

// `<kind>-<UTC timestamp with dashes>`, the naming the pre-import backups already use.
const snapshotName = /^(before-[a-z]+(?:-[a-z]+)*)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;
// Holds the data a restore replaced. Kept so nothing is ever deleted, but not offered: it is
// usually the data that would not open.
const replacedKind = "before-restore";

export interface DirectoryLocalDataSnapshotsOptions {
  // userData/backups
  backupsDir: string;
  // userData/data
  dataDir: string;
  now?: () => Date;
}

// Snapshots stored as copies of the data folder, such as `backups/before-migration-<time>/` with
// the same `pglite` and `files` folders. Restoring copies one back, so it stays restorable.
export class DirectoryLocalDataSnapshots implements LocalDataSnapshotSource {
  private readonly now: () => Date;

  constructor(private readonly options: DirectoryLocalDataSnapshotsOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async list(): Promise<LocalDataSnapshot[]> {
    let names: string[];
    try {
      names = await readdir(this.options.backupsDir);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return [];
      throw error;
    }

    const snapshots: LocalDataSnapshot[] = [];
    for (const name of names) {
      const match = snapshotName.exec(name);
      if (!match || match[1] === replacedKind) continue;
      if (!(await isDirectory(join(this.options.backupsDir, name, "pglite")))) continue;
      const [, kind, date, hours, minutes, seconds] = match;
      const createdAt = new Date(`${date}T${hours}:${minutes}:${seconds}Z`);
      if (Number.isNaN(createdAt.getTime())) continue;
      snapshots.push({ id: name, kind: kind!, createdAt: createdAt.toISOString() });
    }
    return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async restore(id: string): Promise<void> {
    const snapshot = (await this.list()).find((candidate) => candidate.id === id);
    if (!snapshot) throw new LocalDataRestoreError("That backup is no longer available.");

    const { backupsDir, dataDir } = this.options;
    const replaced = join(backupsDir, `${replacedKind}-${fileTimestamp(this.now())}`);
    await mkdir(backupsDir, { recursive: true });
    const hadData = await exists(dataDir);
    if (hadData) {
      try {
        await rename(dataDir, replaced);
      } catch (error) {
        throw new LocalDataRestoreError(
          "Your current data folder could not be moved aside, so nothing was restored.",
          { cause: error },
        );
      }
    }

    try {
      await cp(join(backupsDir, snapshot.id), dataDir, { recursive: true, errorOnExist: true });
    } catch (error) {
      await rm(dataDir, { recursive: true, force: true });
      if (hadData) await rename(replaced, dataDir);
      throw new LocalDataRestoreError(
        "The backup could not be copied. Your current data was left in place.",
        { cause: error },
      );
    }
  }
}

// Sortable and valid in file names on every platform.
function fileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then(
    (stats) => stats.isDirectory(),
    () => false,
  );
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

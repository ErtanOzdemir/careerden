import type { Dirent } from "node:fs";
import { cp, lstat, mkdir, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lastOpenedVersionFile } from "./last-opened-version.js";

// What a snapshot copies out of the data folder. `pglite` is the database, `files` the stored
// documents and images, and the version record makes a restored folder report the version it
// came from.
const snapshotEntries = ["pglite", "files", lastOpenedVersionFile] as const;

// `before-migration-<UTC timestamp with dashes>`. The name sorts by time and matches the
// `before-<kind>-<time>` folders the startup recovery screen lists and restores.
const snapshotKind = "before-migration";
const snapshotName = /^before-migration-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;
// A copy in progress. Renamed to its final name only once complete, so an interrupted copy is
// never mistaken for a usable snapshot.
const partialPrefix = ".partial-";

// Room kept free beyond the copy itself, so the migrations that follow and the rest of the
// system still have space to write.
export const snapshotHeadroomBytes = 100 * 1024 * 1024;

export const snapshotManifestFile = "snapshot.json";

export interface LocalDataSnapshotManifest {
  kind: typeof snapshotKind;
  createdAt: string;
  // The version that last opened the data successfully, or undefined when it was not recorded.
  fromVersion: string | undefined;
  toVersion: string;
  reason: string;
}

export interface CreateLocalDataSnapshotOptions {
  // userData/data
  dataDir: string;
  // userData/backups
  backupsDir: string;
  fromVersion: string | undefined;
  toVersion: string;
  reason: string;
  now?: () => Date;
  // Bytes available to an unprivileged user on the disk holding `path`.
  freeSpace?: (path: string) => Promise<number>;
}

export interface LocalDataSnapshot {
  id: string;
  path: string;
  sizeBytes: number;
}

// Carries a message written for the user. Nothing in the data folder has been changed.
export class LocalDataSnapshotSpaceError extends Error {
  constructor(
    readonly requiredBytes: number,
    readonly availableBytes: number,
  ) {
    super(
      `Your data could not be backed up before this update: it needs ${formatBytes(requiredBytes)} ` +
        `of free disk space, but only ${formatBytes(availableBytes)} is available. ` +
        "Free up some space and open the app again. Your data has not been changed.",
    );
    this.name = "LocalDataSnapshotSpaceError";
  }
}

// Copies the database and stored files to `backups/before-migration-<time>/`. The database must
// be closed: a copy of an open PGlite folder is not consistent.
export async function createLocalDataSnapshot(
  options: CreateLocalDataSnapshotOptions,
): Promise<LocalDataSnapshot> {
  const now = options.now?.() ?? new Date();
  const id = `${snapshotKind}-${fileTimestamp(now)}`;
  const target = join(options.backupsDir, id);
  const partial = join(options.backupsDir, `${partialPrefix}${id}`);

  await mkdir(options.backupsDir, { recursive: true });
  await rm(partial, { recursive: true, force: true });

  const present: string[] = [];
  let sizeBytes = 0;
  for (const entry of snapshotEntries) {
    const source = join(options.dataDir, entry);
    const size = await pathSize(source);
    if (size === undefined) continue;
    present.push(entry);
    sizeBytes += size;
  }

  const requiredBytes = sizeBytes + snapshotHeadroomBytes;
  const availableBytes = await (options.freeSpace ?? availableDiskSpace)(options.backupsDir);
  if (availableBytes < requiredBytes) {
    throw new LocalDataSnapshotSpaceError(requiredBytes, availableBytes);
  }

  try {
    await mkdir(partial);
    for (const entry of present) {
      await cp(join(options.dataDir, entry), join(partial, entry), {
        recursive: true,
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
      });
    }
    const manifest: LocalDataSnapshotManifest = {
      kind: snapshotKind,
      createdAt: now.toISOString(),
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      reason: options.reason,
    };
    await writeFile(
      join(partial, snapshotManifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }

  return { id, path: target, sizeBytes };
}

// Deletes all but the newest `keep` pre-migration snapshots and any copy left half-finished by an
// interrupted launch. Other backups in the folder, such as those a restore set aside, stay.
export async function pruneLocalDataSnapshots(options: {
  backupsDir: string;
  keep: number;
}): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(options.backupsDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return [];
    throw error;
  }

  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const snapshots = directories.filter((name) => snapshotName.test(name)).sort();
  const stale = directories.filter(
    (name) => name.startsWith(partialPrefix) && snapshotName.test(name.slice(partialPrefix.length)),
  );
  const removed = [...stale, ...snapshots.slice(0, Math.max(0, snapshots.length - options.keep))];

  for (const name of removed) {
    await rm(join(options.backupsDir, name), { recursive: true, force: true });
  }
  return removed;
}

export async function availableDiskSpace(path: string): Promise<number> {
  const stats = await statfs(path);
  return Number(stats.bavail) * Number(stats.bsize);
}

// Total size of the files under `path`, or undefined when it does not exist.
async function pathSize(path: string): Promise<number | undefined> {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
  if (!stats.isDirectory()) return stats.size;

  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return total;
}

// Sortable and valid in file names on every platform.
function fileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

function formatBytes(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} ${units[0]}` : `${value.toFixed(1)} ${units[unit]}`;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

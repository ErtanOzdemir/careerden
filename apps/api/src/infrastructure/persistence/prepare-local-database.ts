import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Knex } from "knex";
import {
  createPgliteDb,
  listPendingPostgresMigrations,
  runPostgresMigrations,
} from "@careerden/infrastructure";
import { readLastOpenedVersion, writeLastOpenedVersion } from "./last-opened-version.js";
import { createLocalDataSnapshot, pruneLocalDataSnapshots } from "./local-data-snapshots.js";

export const defaultKeptLocalDataSnapshots = 3;

export interface LocalDataSnapshotPolicy {
  // The running app's version, recorded after a successful launch.
  appVersion: string;
  // userData/backups, outside the data folder it copies.
  backupsDir: string;
  // How many pre-migration snapshots to keep; older ones are deleted.
  keep?: number;
  log?: (message: string) => void;
  now?: () => Date;
  freeSpace?: (path: string) => Promise<number>;
}

// Opens the local PGlite database and brings it to the current schema. With a snapshot policy,
// existing data is first copied to the backups folder whenever this launch may change it: the
// app version differs from the one that last opened it, or migrations are pending. The copy is
// taken while the database is closed and before any migration runs. The version is recorded only
// after the migrations succeed, so a failed upgrade snapshots again on the next attempt.
export async function prepareLocalDatabase(
  dataDir: string,
  snapshots?: LocalDataSnapshotPolicy,
): Promise<Knex> {
  const pgliteDir = join(dataDir, "pglite");
  if (!snapshots) return migrate(createPgliteDb(pgliteDir));

  const log = snapshots.log ?? (() => undefined);
  const previous = await readLastOpenedVersion(dataDir);
  let db: Knex | undefined;

  if (await exists(pgliteDir)) {
    let reason: string | undefined;
    if (previous?.version !== snapshots.appVersion) {
      reason = previous
        ? `the app was updated from v${previous.version} to v${snapshots.appVersion}`
        : `no app version was recorded for the data; opening it with v${snapshots.appVersion}`;
    } else {
      // Same version, but the schema may still be behind, for example after a failed migration.
      // Only reads; the database is closed again before anything is copied.
      db = createPgliteDb(pgliteDir);
      const pending = await listPendingPostgresMigrations(db).catch(async (error: unknown) => {
        await db?.destroy();
        throw error;
      });
      if (pending.length > 0) {
        reason = `${pending.length} database migration(s) are pending`;
        await db.destroy();
        db = undefined;
      }
    }

    if (reason) {
      const snapshot = await createLocalDataSnapshot({
        dataDir,
        backupsDir: snapshots.backupsDir,
        fromVersion: previous?.version,
        toVersion: snapshots.appVersion,
        reason,
        ...(snapshots.now ? { now: snapshots.now } : {}),
        ...(snapshots.freeSpace ? { freeSpace: snapshots.freeSpace } : {}),
      });
      log(
        `Created local data snapshot ${snapshot.id} (${snapshot.sizeBytes} bytes) before ` +
          `migrating because ${reason}`,
      );
      const removed = await pruneLocalDataSnapshots({
        backupsDir: snapshots.backupsDir,
        keep: snapshots.keep ?? defaultKeptLocalDataSnapshots,
      });
      for (const id of removed) log(`Removed old local data snapshot ${id}`);
    }
  }

  const migrated = await migrate(db ?? createPgliteDb(pgliteDir));
  if (previous?.version !== snapshots.appVersion) {
    try {
      await writeLastOpenedVersion(dataDir, snapshots.appVersion, snapshots.now?.());
    } catch (error) {
      await migrated.destroy();
      throw error;
    }
  }
  return migrated;
}

async function migrate(db: Knex): Promise<Knex> {
  try {
    await runPostgresMigrations(db);
    return db;
  } catch (error) {
    await db.destroy();
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

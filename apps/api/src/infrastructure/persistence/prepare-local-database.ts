import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Knex } from "knex";
import { createPgliteDb, getPostgresMigrationStatus } from "@careerden/infrastructure";
import type { StructuredLogger } from "@careerden/infrastructure";
import { readLastOpenedVersion, writeLastOpenedVersion } from "./last-opened-version.js";
import { openLocalDatabase } from "./local-database-startup.js";
import { createLocalDataSnapshot, pruneLocalDataSnapshots } from "./local-data-snapshots.js";
import { recordPgliteEngine } from "./pglite-engine.js";

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
// Opening and migrating go through openLocalDatabase, so failures there throw
// LocalDatabaseStartupError for the recovery screen. Once open, the bundled PGlite engine is
// recorded next to the data, so a future engine upgrade knows which format the data is in.
export async function prepareLocalDatabase(
  dataDir: string,
  snapshots?: LocalDataSnapshotPolicy,
  logger?: StructuredLogger,
): Promise<{ db: Knex; lastMigration: string | undefined }> {
  const pgliteDir = join(dataDir, "pglite");
  if (!snapshots) {
    return withRecordedEngine(dataDir, await openLocalDatabase(pgliteDir, undefined, logger), {
      logger,
    });
  }

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
      // Only reads; the database is closed again before anything is copied. When it cannot be
      // read, openLocalDatabase below reopens it and reports which stage failed.
      const inspected = createPgliteDb(pgliteDir);
      const status = await getPostgresMigrationStatus(inspected).catch(() => undefined);
      if (status && status.pending.length > 0) {
        reason = `${status.pending.length} database migration(s) are pending`;
      }
      if (status && !reason) {
        db = inspected;
      } else {
        await inspected.destroy();
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

  const opened = await withRecordedEngine(dataDir, await openLocalDatabase(pgliteDir, db, logger), {
    logger,
    now: snapshots.now,
  });
  if (previous?.version !== snapshots.appVersion) {
    try {
      await writeLastOpenedVersion(dataDir, snapshots.appVersion, snapshots.now?.());
    } catch (error) {
      await opened.db.destroy();
      throw error;
    }
  }
  return opened;
}

// Records the engine for a database that opened and migrated, closing it if the record cannot be
// written.
async function withRecordedEngine<T extends { db: Knex }>(
  dataDir: string,
  opened: T,
  options: { logger?: StructuredLogger | undefined; now?: (() => Date) | undefined },
): Promise<T> {
  try {
    const { changed, previous } = await recordPgliteEngine(dataDir, opened.db, options.now?.());
    if (changed) {
      options.logger?.({
        level: "info",
        event: "database.engine_recorded",
        fields: {
          previousPglite: previous?.pglite ?? null,
          previousPostgres: previous?.postgres ?? null,
        },
      });
    }
    return opened;
  } catch (error) {
    await opened.db.destroy();
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

import type { Knex } from "knex";
import {
  createPgliteDb,
  describeErrorForLog,
  getPostgresMigrationStatus,
  runPostgresMigrations,
} from "@careerden/infrastructure";
import type { StructuredLogger } from "@careerden/infrastructure";

// Why the local database could not be opened. The desktop shell shows a recovery screen for each
// instead of restarting, because none of them goes away on the next launch.
export const localDatabaseStartupFailureReasons = [
  // PGlite could not open the data directory: damaged files or an incompatible PGlite version.
  "database-open",
  // A migration this build ships failed to apply.
  "migration",
  // The data was migrated by a newer Careerden that ships migrations this build does not.
  "newer-version",
] as const;

export type LocalDatabaseStartupFailureReason = (typeof localDatabaseStartupFailureReasons)[number];

export interface LocalDatabaseStartupFailure {
  reason: LocalDatabaseStartupFailureReason;
  message: string;
  lastMigration?: string;
  unknownMigrations?: string[];
}

export class LocalDatabaseStartupError extends Error {
  constructor(
    readonly failure: LocalDatabaseStartupFailure,
    options?: { cause?: unknown },
  ) {
    super(failure.message, options);
    this.name = "LocalDatabaseStartupError";
  }
}

export function describeLocalDatabaseStartupError(
  error: unknown,
): LocalDatabaseStartupFailure | undefined {
  return error instanceof LocalDatabaseStartupError ? error.failure : undefined;
}

// Opens the PGlite database in `directory` and migrates it to the latest schema, in stages, so a
// failure says which stage broke. The database is closed again when any stage fails. A caller
// that already opened the database to inspect it passes that connection as `db`. Migration
// progress and failures go to `log`.
export async function openLocalDatabase(
  directory: string,
  db: Knex = createPgliteDb(directory),
  log: StructuredLogger = () => undefined,
): Promise<{ db: Knex; lastMigration: string | undefined }> {
  try {
    // PGlite opens its files on the first query.
    await db.raw("select 1").catch((error: unknown) => {
      throw new LocalDatabaseStartupError(
        { reason: "database-open", message: `The database could not be opened: ${text(error)}` },
        { cause: error },
      );
    });

    const status = await getPostgresMigrationStatus(db);
    const lastMigration = status.latestApplied;
    if (status.unknown.length > 0) {
      throw new LocalDatabaseStartupError({
        reason: "newer-version",
        message: "This data was created by a newer version of Careerden.",
        ...(lastMigration ? { lastMigration } : {}),
        unknownMigrations: status.unknown,
      });
    }

    const startedAt = Date.now();
    log({ level: "info", event: "migration.started", fields: { pending: status.pending.length } });
    const applied = await runPostgresMigrations(db).catch(async (error: unknown) => {
      const reached = (await getPostgresMigrationStatus(db).catch(() => status)).latestApplied;
      throw new LocalDatabaseStartupError(
        {
          reason: "migration",
          message: `A database update failed: ${text(error)}`,
          ...(reached ? { lastMigration: reached } : {}),
        },
        { cause: error },
      );
    });

    log({
      level: "info",
      event: "migration.finished",
      fields: { applied: applied.length, durationMs: Date.now() - startedAt },
    });

    return { db, lastMigration: status.pending.at(-1) ?? lastMigration };
  } catch (error) {
    if (error instanceof LocalDatabaseStartupError) {
      log({
        level: "error",
        event: error.failure.reason === "migration" ? "migration.failed" : "database.open_failed",
        fields: {
          reason: error.failure.reason,
          lastMigration: error.failure.lastMigration ?? null,
          ...describeErrorForLog(error.cause ?? error),
        },
      });
    }
    await db.destroy().catch(() => undefined);
    throw error;
  }
}

function text(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

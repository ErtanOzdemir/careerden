import type { Knex } from "knex";
import {
  createPgliteDb,
  getPostgresMigrationStatus,
  runPostgresMigrations,
} from "@careerden/infrastructure";

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
// failure says which stage broke. The database is closed again when any stage fails.
export async function openLocalDatabase(
  directory: string,
): Promise<{ db: Knex; lastMigration: string | undefined }> {
  const db = createPgliteDb(directory);
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

    await runPostgresMigrations(db).catch(async (error: unknown) => {
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

    return { db, lastMigration: status.pending.at(-1) ?? lastMigration };
  } catch (error) {
    await db.destroy().catch(() => undefined);
    throw error;
  }
}

function text(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

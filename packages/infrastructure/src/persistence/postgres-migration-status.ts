import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";

// Knex's default bookkeeping table, which runPostgresMigrations uses.
const migrationsTable = "knex_migrations";

export interface PostgresMigrationStatus {
  // Recorded in the database, oldest first.
  applied: string[];
  // Shipped with this build but not applied yet.
  pending: string[];
  // Applied by a build that ships migrations this one does not, such as a newer version.
  unknown: string[];
  // The most recently applied migration, or undefined for a database that has none.
  latestApplied: string | undefined;
}

// Compares the database's applied migrations with the ones this build ships, without running
// any. Knex itself rejects unknown migrations only as a "corrupt migration directory".
export async function getPostgresMigrationStatus(db: Knex): Promise<PostgresMigrationStatus> {
  const shipped = await listShippedPostgresMigrations();
  const applied = (await db.schema.hasTable(migrationsTable))
    ? (await db(migrationsTable).select<Array<{ name: string }>>("name"))
        .map((row) => row.name)
        .sort()
    : [];
  const appliedNames = new Set(applied);
  const shippedNames = new Set(shipped);

  return {
    applied,
    pending: shipped.filter((name) => !appliedNames.has(name)),
    unknown: applied.filter((name) => !shippedNames.has(name)),
    latestApplied: applied.at(-1),
  };
}

// Names start with a timestamp, so they sort in the order Knex applies them.
async function listShippedPostgresMigrations(): Promise<string[]> {
  const directory = join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations");
  return (await readdir(directory)).filter((name) => name.endsWith(".cjs")).sort();
}

import knex, { type Knex } from "knex";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "postgres-migrations",
);
const migrationConfig: Knex.MigratorConfig = {
  directory: migrationsDirectory,
  extension: "cjs",
  loadExtensions: [".cjs"],
};

export function createPostgresDb(connectionString: string): Knex {
  return knex({
    client: "pg",
    connection: connectionString,
    pool: {
      min: 0,
      max: 10,
    },
  });
}

export async function runPostgresMigrations(db: Knex): Promise<void> {
  await db.migrate.latest(migrationConfig);
}

// Every migration this build ships, oldest first. Names start with a timestamp, so they sort in
// the order Knex applies them.
export function listPostgresMigrations(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".cjs"))
    .sort();
}

// The most recently applied migration, or undefined for a database that has none.
export async function getLatestAppliedPostgresMigration(db: Knex): Promise<string | undefined> {
  const [completed] = (await db.migrate.list(migrationConfig)) as [Array<{ name: string }>];
  return completed
    .map((migration) => migration.name)
    .sort()
    .at(-1);
}

// Applies migrations one at a time up to and including `name`, which must be one this build
// ships. Recreates an older schema exactly, for example to restore data exported from it before
// the remaining migrations transform that data.
export async function runPostgresMigrationsThrough(db: Knex, name: string): Promise<void> {
  if (!listPostgresMigrations().includes(name)) {
    throw new Error(`Unknown migration: ${name}`);
  }

  let latest = await getLatestAppliedPostgresMigration(db);
  while (latest === undefined || latest < name) {
    await db.migrate.up(migrationConfig);
    const next = await getLatestAppliedPostgresMigration(db);
    if (next === latest) throw new Error(`Migration ${name} could not be applied`);
    latest = next;
  }
}

import knex, { type Knex } from "knex";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

// Resolves with the names of the migrations this call applied.
export async function runPostgresMigrations(db: Knex): Promise<string[]> {
  const [, applied] = (await db.migrate.latest(migrationConfig())) as [unknown, string[]];
  return applied;
}

// Names of the shipped migrations the database has not applied yet, oldest first. Runs none.
export async function listPendingPostgresMigrations(db: Knex): Promise<string[]> {
  const [, pending] = (await db.migrate.list(migrationConfig())) as [unknown, unknown[]];
  return pending.map((migration) =>
    typeof migration === "object" && migration !== null && "file" in migration
      ? String(migration.file)
      : String(migration),
  );
}

function migrationConfig(): Knex.MigratorConfig {
  return {
    directory: join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations"),
    extension: "cjs",
    loadExtensions: [".cjs"],
  };
}

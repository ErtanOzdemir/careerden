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
  const directory = join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations");

  const [, applied] = (await db.migrate.latest({
    directory,
    extension: "cjs",
    loadExtensions: [".cjs"],
  })) as [number, string[]];
  return applied;
}

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

export async function runPostgresMigrations(db: Knex): Promise<void> {
  const directory = join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations");

  await db.migrate.latest({
    directory,
    extension: "cjs",
    loadExtensions: [".cjs"],
  });
}

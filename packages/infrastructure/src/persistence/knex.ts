import knex, { type Knex } from "knex";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function createSqliteDb(filePath: string): Knex {
  return knex({
    client: "better-sqlite3",
    connection: { filename: filePath },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn: { pragma: (s: string) => void }, cb: (err: Error | null) => void) => {
        conn.pragma("journal_mode = WAL");
        conn.pragma("foreign_keys = ON");
        cb(null);
      },
    },
  });
}

export async function runSqliteMigrations(db: Knex): Promise<void> {
  const directory = join(fileURLToPath(new URL(".", import.meta.url)), "migrations");

  await db.migrate.latest({
    directory,
    extension: "cjs",
    loadExtensions: [".cjs"],
  });
}

export async function destroyDb(db: Knex): Promise<void> {
  await db.destroy();
}

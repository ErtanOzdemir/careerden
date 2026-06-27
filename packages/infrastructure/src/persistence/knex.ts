import type { Knex } from "knex";

export async function destroyDb(db: Knex): Promise<void> {
  await db.destroy();
}

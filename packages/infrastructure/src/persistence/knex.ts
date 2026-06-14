import knex, { type Knex } from "knex";

export function createDb(databaseUrl: string): Knex {
  return knex({
    client: "pg",
    connection: databaseUrl,
    pool: {
      min: 0,
      max: 10,
    },
  });
}

export async function destroyDb(db: Knex): Promise<void> {
  await db.destroy();
}

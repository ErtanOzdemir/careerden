import type { Knex } from "knex";

// Knex's own bookkeeping; the restoring database writes these itself while it migrates.
const migrationTables = ["knex_migrations", "knex_migrations_lock"];

// Every application table in the current schema, sorted by name.
export async function listDataTables(db: Knex | Knex.Transaction): Promise<string[]> {
  const rows = (await db("information_schema.tables")
    .select("table_name")
    .where({ table_schema: db.raw("current_schema()"), table_type: "BASE TABLE" })
    .whereNotIn("table_name", migrationTables)
    .orderBy("table_name")) as Array<{ table_name: string }>;
  return rows.map((row) => row.table_name);
}

// Renders a table's rows as one JSON array. Postgres does the encoding, so jsonb, timestamps,
// and numeric values round-trip exactly through json_populate_recordset.
export async function readTableRowsJson(
  db: Knex | Knex.Transaction,
  table: string,
): Promise<{ json: string; rows: number }> {
  const result = await db.raw<{ rows: Array<{ json: string; rows: number }> }>(
    "select coalesce(json_agg(t), '[]'::json)::text as json, count(*)::int as rows from ?? as t",
    [table],
  );
  const [row] = result.rows;
  return { json: row?.json ?? "[]", rows: row?.rows ?? 0 };
}

// Replaces the contents of `tables` with archived rows. Foreign keys and triggers are suspended
// for the transaction so tables can load in any order; the rows come from a consistent export.
export async function replaceTableRows(
  trx: Knex.Transaction,
  rowsByTable: ReadonlyMap<string, string>,
): Promise<void> {
  const tables = [...rowsByTable.keys()];
  await trx.raw("set local session_replication_role = replica");
  if (tables.length > 0) {
    await trx.raw(`truncate table ${tables.map(() => "??").join(", ")}`, tables);
  }
  for (const [table, json] of rowsByTable) {
    await trx.raw("insert into ?? select * from json_populate_recordset(null::??, ?::json)", [
      table,
      table,
      json,
    ]);
  }
}

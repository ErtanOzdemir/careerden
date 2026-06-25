import { afterEach, describe, expect, it } from "vitest";
import type { Knex } from "knex";
import { createSqliteDb, destroyDb, runSqliteMigrations } from "./knex.js";

let db: Knex | undefined;

afterEach(async () => {
  if (db) {
    await destroyDb(db);
    db = undefined;
  }
});

describe("runSqliteMigrations", () => {
  it("creates the desktop SQLite schema from migrations", async () => {
    db = createSqliteDb(":memory:");

    await runSqliteMigrations(db);

    await expectTable("user_profiles");
    await expectTable("job_applications");
    await expectTable("job_application_events");
    await expectTable("job_application_contacts");
    await expectTable("job_application_interviews");
    await expectTable("generated_documents");
    await expectTable("document_templates");
    await expectTable("knex_migrations");

    await expectColumn("user_profiles", "profession");
    await expectColumn("user_profiles", "links");
    await expectColumn("job_applications", "document_content");
    await expectColumn("job_applications", "company_logo_file_id");
    await expectColumn("document_templates", "variable_aliases");
  });

  it("can run repeatedly without changing an up-to-date schema", async () => {
    db = createSqliteDb(":memory:");

    await runSqliteMigrations(db);
    await runSqliteMigrations(db);

    const migrations = await db("knex_migrations").select("name");

    expect(migrations).toEqual([{ name: "20260625000000_sqlite_baseline.cjs" }]);
  });
});

async function expectTable(name: string): Promise<void> {
  const row = await db?.select("name").from("sqlite_master").where({ type: "table", name }).first();

  expect(row).toEqual({ name });
}

async function expectColumn(tableName: string, columnName: string): Promise<void> {
  const columns = await db?.raw(`PRAGMA table_info(${tableName})`);

  expect(columns).toEqual(expect.arrayContaining([expect.objectContaining({ name: columnName })]));
}

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";
import { afterEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite-knex.js";
import { runPostgresMigrations, runPostgresMigrationsThrough } from "./postgres-knex.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

const previousMigration = "20261112000000_profile_skill_groups.cjs";
const phoneMigration = "20261115000000_profile_phone.cjs";
const migrationConfig: Knex.MigratorConfig = {
  directory: join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations"),
  extension: "cjs",
  loadExtensions: [".cjs"],
};

// Runs the profile phone migration against embedded PGlite, the same Knex migration the cloud
// edition runs against PostgreSQL.
describe("profile phone migration", { timeout: 30_000 }, () => {
  const databases: Knex[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
  });

  async function openDbWithProfile(): Promise<Knex> {
    const db = createPgliteDb();
    databases.push(db);
    await runPostgresMigrationsThrough(db, previousMigration);
    await db("user").insert({ id: "ada", name: "", email: "ada@example.com" });
    await db("user_profiles").insert({
      id: "ada-profile",
      user_id: "ada",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
    });
    return db;
  }

  it("adds an empty phone to existing profiles that can then be saved and cleared", async () => {
    const db = await openDbWithProfile();

    await runPostgresMigrations(db);

    const profiles = new PostgresUserProfileRepository(db);
    const existing = await profiles.findByUserId("ada");
    expect(existing).toMatchObject({ fullName: "Ada Lovelace" });
    expect(existing?.phone).toBeUndefined();

    await profiles.update("ada-profile", { phone: "+44 20 7946 0958" });
    await expect(profiles.findByUserId("ada")).resolves.toMatchObject({
      phone: "+44 20 7946 0958",
    });

    await profiles.update("ada-profile", { phone: "" });
    expect((await profiles.findByUserId("ada"))?.phone).toBeUndefined();
    expect((await db("user_profiles").where({ id: "ada-profile" }).first()).phone).toBeNull();
  });

  it("drops the column when rolled back", async () => {
    const db = await openDbWithProfile();
    // migrate.down undoes only the newest migration, so stop at this one.
    await runPostgresMigrationsThrough(db, phoneMigration);
    await new PostgresUserProfileRepository(db).update("ada-profile", { phone: "555 0100" });

    await db.migrate.down(migrationConfig);

    expect(await db.schema.hasColumn("user_profiles", "phone")).toBe(false);
    const row = await db("user_profiles").where({ id: "ada-profile" }).first();
    expect(row.full_name).toBe("Ada Lovelace");
  });
});

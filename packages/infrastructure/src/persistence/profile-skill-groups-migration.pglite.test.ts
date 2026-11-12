import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";
import { afterEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite-knex.js";
import { runPostgresMigrations, runPostgresMigrationsThrough } from "./postgres-knex.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

const previousMigration = "20261108000000_job_application_ai_failure.cjs";
const migrationConfig: Knex.MigratorConfig = {
  directory: join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations"),
  extension: "cjs",
  loadExtensions: [".cjs"],
};

// Runs the skill groups migration against embedded PGlite, the same Knex migration the cloud
// edition runs against PostgreSQL.
describe("profile skill groups migration", { timeout: 30_000 }, () => {
  const databases: Knex[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
  });

  async function openDbWithFlatSkills(skillsByUser: Record<string, unknown>): Promise<Knex> {
    const db = createPgliteDb();
    databases.push(db);
    await runPostgresMigrationsThrough(db, previousMigration);
    for (const [userId, skills] of Object.entries(skillsByUser)) {
      await db("user").insert({ id: userId, name: "", email: `${userId}@example.com` });
      await db("user_profiles").insert({
        id: `${userId}-profile`,
        user_id: userId,
        full_name: "Ada Lovelace",
        email: `${userId}@example.com`,
        skills: JSON.stringify(skills),
      });
    }
    return db;
  }

  it("moves every existing skill, in order, into one uncategorized group", async () => {
    const db = await openDbWithFlatSkills({
      ada: ["TypeScript", "Kubernetes", "PostgreSQL"],
      grace: [],
    });

    await runPostgresMigrations(db);

    const profiles = new PostgresUserProfileRepository(db);
    await expect(profiles.findByUserId("ada")).resolves.toMatchObject({
      skillGroups: [{ name: "", skills: ["TypeScript", "Kubernetes", "PostgreSQL"] }],
    });
    await expect(profiles.findByUserId("grace")).resolves.toMatchObject({ skillGroups: [] });
    expect(await db.schema.hasColumn("user_profiles", "skills")).toBe(false);
  });

  it("flattens the groups back into the old list when rolled back", async () => {
    const db = await openDbWithFlatSkills({ ada: ["TypeScript"] });
    await runPostgresMigrations(db);
    await new PostgresUserProfileRepository(db).update("ada-profile", {
      skillGroups: [
        { name: "Frontend", skills: ["React", "CSS"] },
        { name: "", skills: ["TypeScript"] },
      ],
    });

    await db.migrate.down(migrationConfig);

    const row = await db("user_profiles").where({ id: "ada-profile" }).first();
    expect(row.skills).toEqual(["React", "CSS", "TypeScript"]);
    expect(await db.schema.hasColumn("user_profiles", "skill_groups")).toBe(false);
  });
});

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";
import { afterEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite-knex.js";
import { runPostgresMigrations, runPostgresMigrationsThrough } from "./postgres-knex.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

const previousMigration = "20261112000000_profile_skill_groups.cjs";
const typedLinksMigration = "20261115000100_profile_typed_links.cjs";
const migrationConfig: Knex.MigratorConfig = {
  directory: join(fileURLToPath(new URL(".", import.meta.url)), "postgres-migrations"),
  extension: "cjs",
  loadExtensions: [".cjs"],
};

// Runs the typed links migration against embedded PGlite, the same Knex migration the cloud
// edition runs against PostgreSQL.
describe("profile typed links migration", { timeout: 30_000 }, () => {
  const databases: Knex[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
  });

  async function openDbWithStringLinks(linksByUser: Record<string, unknown>): Promise<Knex> {
    const db = createPgliteDb();
    databases.push(db);
    await runPostgresMigrationsThrough(db, previousMigration);
    for (const [userId, links] of Object.entries(linksByUser)) {
      await db("user").insert({ id: userId, name: "", email: `${userId}@example.com` });
      await db("user_profiles").insert({
        id: `${userId}-profile`,
        user_id: userId,
        full_name: "Ada Lovelace",
        email: `${userId}@example.com`,
        links: JSON.stringify(links),
      });
    }
    return db;
  }

  async function storedLinks(db: Knex, userId: string): Promise<unknown> {
    const row = await db("user_profiles")
      .where({ id: `${userId}-profile` })
      .first();
    return row.links;
  }

  it("types every existing link by hostname and keeps the order", async () => {
    const db = await openDbWithStringLinks({
      ada: [
        "https://ada.example.com/",
        "https://www.linkedin.com/in/ada/",
        "https://github.com/ada",
        "https://uk.linkedin.com/in/ada",
        "https://ada.github.io/",
        "HTTPS://GitHub.com/ada-lab",
      ],
      grace: [],
    });

    await runPostgresMigrations(db);

    expect(await storedLinks(db, "ada")).toEqual([
      { kind: "website", url: "https://ada.example.com/" },
      { kind: "linkedin", url: "https://www.linkedin.com/in/ada/" },
      { kind: "github", url: "https://github.com/ada" },
      { kind: "linkedin", url: "https://uk.linkedin.com/in/ada" },
      { kind: "website", url: "https://ada.github.io/" },
      { kind: "github", url: "HTTPS://GitHub.com/ada-lab" },
    ]);
    expect(await storedLinks(db, "grace")).toEqual([]);
    await expect(new PostgresUserProfileRepository(db).findByUserId("ada")).resolves.toMatchObject({
      links: expect.arrayContaining([{ kind: "github", url: "https://github.com/ada" }]),
    });
  });

  it("skips malformed elements instead of failing", async () => {
    const db = await openDbWithStringLinks({
      ada: ["", "   ", null, { url: "https://example.com" }, 42, ["x"], " https://github.com/ada "],
      grace: [null, ""],
      linus: { url: "https://example.com" },
    });

    await runPostgresMigrations(db);

    expect(await storedLinks(db, "ada")).toEqual([
      { kind: "github", url: "https://github.com/ada" },
    ]);
    expect(await storedLinks(db, "grace")).toEqual([]);
    expect(await storedLinks(db, "linus")).toEqual([]);
  });

  it("keeps links that are already typed, so running it again changes nothing", async () => {
    const db = await openDbWithStringLinks({
      ada: [{ kind: "portfolio", url: "https://ada.dev/work" }, "https://github.com/ada"],
    });
    await runPostgresMigrations(db);
    const migrated = await storedLinks(db, "ada");

    await db.migrate.down({ ...migrationConfig, name: typedLinksMigration });
    await db("user_profiles")
      .where({ id: "ada-profile" })
      .update({ links: JSON.stringify(migrated) });
    await runPostgresMigrations(db);

    expect(migrated).toEqual([
      { kind: "portfolio", url: "https://ada.dev/work" },
      { kind: "github", url: "https://github.com/ada" },
    ]);
    expect(await storedLinks(db, "ada")).toEqual(migrated);
  });

  it("flattens the typed links back into URL strings when rolled back", async () => {
    const db = await openDbWithStringLinks({ ada: ["https://github.com/ada"] });
    await runPostgresMigrations(db);
    // Written directly so the rollback also meets elements the app would never store.
    await db("user_profiles")
      .where({ id: "ada-profile" })
      .update({
        links: JSON.stringify([
          { kind: "portfolio", url: "https://ada.example.com/work" },
          { kind: "other" },
          "legacy",
          { kind: "linkedin", url: "https://www.linkedin.com/in/ada" },
        ]),
      });

    await db.migrate.down({ ...migrationConfig, name: typedLinksMigration });

    expect(await storedLinks(db, "ada")).toEqual([
      "https://ada.example.com/work",
      "https://www.linkedin.com/in/ada",
    ]);
  });
});

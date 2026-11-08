import type { Knex } from "knex";
import { afterEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite-knex.js";
import { runPostgresMigrations } from "./postgres-knex.js";
import { getPostgresMigrationStatus } from "./postgres-migration-status.js";

describe("getPostgresMigrationStatus", { timeout: 30_000 }, () => {
  const databases: Knex[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
  });

  function openDb(): Knex {
    const db = createPgliteDb();
    databases.push(db);
    return db;
  }

  it("lists every shipped migration as pending for an empty database", async () => {
    const status = await getPostgresMigrationStatus(openDb());

    expect(status.applied).toEqual([]);
    expect(status.unknown).toEqual([]);
    expect(status.latestApplied).toBeUndefined();
    expect(status.pending[0]).toBe("20260626000000_initial_schema.cjs");
  });

  it("reports the latest applied migration and migrations this build does not ship", async () => {
    const db = openDb();
    await runPostgresMigrations(db);
    const migrated = await getPostgresMigrationStatus(db);
    expect(migrated.pending).toEqual([]);
    expect(migrated.unknown).toEqual([]);
    expect(migrated.latestApplied).toBe(migrated.applied.at(-1));

    await db("knex_migrations").insert({
      name: "29990101000000_from_a_newer_version.cjs",
      batch: 99,
      migration_time: new Date(),
    });

    const downgraded = await getPostgresMigrationStatus(db);
    expect(downgraded.unknown).toEqual(["29990101000000_from_a_newer_version.cjs"]);
    expect(downgraded.latestApplied).toBe("29990101000000_from_a_newer_version.cjs");
  });
});

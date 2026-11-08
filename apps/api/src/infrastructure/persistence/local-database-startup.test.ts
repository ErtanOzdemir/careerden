import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalDatabaseStartupError,
  describeLocalDatabaseStartupError,
  openLocalDatabase,
} from "./local-database-startup.js";

// Adds columns without guards, so it fails when it runs a second time.
const columnMigration = "20261031000000_profile_onboarding_state.cjs";

// Each case leaves a real PGlite directory in the state a user's device could be in.
describe("openLocalDatabase", { timeout: 60_000 }, () => {
  let directory: string;
  let root: string;
  const opened: Knex[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-local-db-"));
    directory = join(root, "pglite");
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((db) => db.destroy()));
    await rm(root, { recursive: true, force: true });
  });

  async function migrateThenEdit(edit: (db: Knex) => Promise<unknown>): Promise<void> {
    const { db } = await openLocalDatabase(directory);
    await edit(db);
    await db.destroy();
  }

  async function startupFailure() {
    const error = await openLocalDatabase(directory).then(
      ({ db }) => {
        opened.push(db);
        throw new Error("The database opened");
      },
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(LocalDatabaseStartupError);
    return describeLocalDatabaseStartupError(error);
  }

  it("creates and migrates a new database and reports its newest migration", async () => {
    const { db, lastMigration } = await openLocalDatabase(directory);
    opened.push(db);

    const [latest] = await db("knex_migrations").max<Array<{ max: string }>>("name as max");
    expect(lastMigration).toBe(latest?.max);
    await expect(db.schema.hasTable("job_applications")).resolves.toBe(true);
  });

  it("reports data from a newer version before Knex calls the migration directory corrupt", async () => {
    await migrateThenEdit((db) =>
      db("knex_migrations").insert({
        name: "29990101000000_from_a_newer_version.cjs",
        batch: 99,
        migration_time: new Date(),
      }),
    );

    await expect(startupFailure()).resolves.toEqual({
      reason: "newer-version",
      message: "This data was created by a newer version of Careerden.",
      lastMigration: "29990101000000_from_a_newer_version.cjs",
      unknownMigrations: ["29990101000000_from_a_newer_version.cjs"],
    });
  });

  it("reports a failing migration with the last one that applied", async () => {
    // Forgetting that a migration ran makes it run again and fail on its own columns.
    let remaining: string[] = [];
    await migrateThenEdit(async (db) => {
      await db("knex_migrations").where({ name: columnMigration }).delete();
      remaining = (await db("knex_migrations").pluck("name")).sort();
    });

    const failure = await startupFailure();

    expect(failure).toMatchObject({ reason: "migration" });
    expect(failure?.message).toMatch(/^A database update failed: .*already exists/);
    expect(failure?.lastMigration).toBe(remaining.at(-1));
  });

  it("reports a data directory that PGlite cannot open", async () => {
    await migrateThenEdit(async () => undefined);
    // What a directory written by an incompatible PGlite release looks like.
    await writeFile(join(directory, "PG_VERSION"), "99\n");

    await expect(startupFailure()).resolves.toMatchObject({
      reason: "database-open",
      message: expect.stringMatching(/^The database could not be opened: /),
    });
  });

  it("leaves other errors unclassified", () => {
    expect(describeLocalDatabaseStartupError(new Error("port in use"))).toBeUndefined();
  });
});

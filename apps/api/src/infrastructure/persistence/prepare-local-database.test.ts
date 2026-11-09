import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, pgliteVersion } from "@careerden/infrastructure";
import type { StructuredLogEntry } from "@careerden/infrastructure";
import { writeLastOpenedVersion } from "./last-opened-version.js";
import { LocalDatabaseStartupError } from "./local-database-startup.js";
import { LocalDataSnapshotSpaceError } from "./local-data-snapshots.js";
import { pgliteEngineFile, readPgliteEngine } from "./pglite-engine.js";
import { prepareLocalDatabase, type LocalDataSnapshotPolicy } from "./prepare-local-database.js";

// Opens real PGlite databases on disk, which takes a few seconds per open in a parallel run.
describe("prepareLocalDatabase", { timeout: 60_000 }, () => {
  let root: string;
  let dataDir: string;
  let backupsDir: string;
  let logged: string[];
  let clock: number;
  const open: Knex[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-prepare-"));
    dataDir = join(root, "data");
    backupsDir = join(root, "backups");
    await mkdir(dataDir, { recursive: true });
    logged = [];
    clock = Date.parse("2026-11-07T10:00:00Z");
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((db) => db.destroy()));
    await rm(root, { recursive: true, force: true });
  });

  function policy(
    appVersion: string,
    overrides: Partial<LocalDataSnapshotPolicy> = {},
  ): LocalDataSnapshotPolicy {
    return {
      appVersion,
      backupsDir,
      log: (message) => logged.push(message),
      // Each launch is a minute after the previous one, so snapshot names differ.
      now: () => new Date((clock += 60_000)),
      freeSpace: async () => Number.MAX_SAFE_INTEGER,
      ...overrides,
    };
  }

  async function launch(appVersion: string, overrides: Partial<LocalDataSnapshotPolicy> = {}) {
    const { db } = await prepareLocalDatabase(dataDir, policy(appVersion, overrides));
    open.push(db);
    return db;
  }

  async function close(db: Knex) {
    open.splice(open.indexOf(db), 1);
    await db.destroy();
  }

  async function snapshots() {
    return (await readdir(backupsDir).catch(() => [])).sort();
  }

  async function recordedVersion() {
    return JSON.parse(await readFile(join(dataDir, "last-opened-version.json"), "utf8")).version;
  }

  // Leaves an unmigrated database with one row, like data written by an older version.
  async function seedUnmigratedDatabase(note: string) {
    const db = createPgliteDb(join(dataDir, "pglite"));
    await db.schema.createTable("legacy_notes", (table) => table.text("note"));
    await db("legacy_notes").insert({ note });
    await db.destroy();
  }

  it("records the version on a fresh install without taking a snapshot", async () => {
    await close(await launch("0.8.0"));

    await expect(snapshots()).resolves.toEqual([]);
    await expect(recordedVersion()).resolves.toBe("0.8.0");
  });

  it("records the bundled PGlite engine next to the data once it opens", async () => {
    const events: StructuredLogEntry[] = [];
    const { db } = await prepareLocalDatabase(dataDir, policy("0.8.0"), (entry) => {
      events.push(entry);
    });
    await close(db);
    await close(await launch("0.8.0"));

    await expect(readPgliteEngine(dataDir)).resolves.toEqual({
      pglite: pgliteVersion,
      postgres: expect.stringMatching(/^\d+\.\d+/),
      recordedAt: expect.any(String),
    });
    expect(events.filter((entry) => entry.event === "database.engine_recorded")).toEqual([
      expect.objectContaining({ fields: { previousPglite: null, previousPostgres: null } }),
    ]);
  });

  it("records the engine for data opened without a snapshot policy", async () => {
    const { db } = await prepareLocalDatabase(dataDir);
    open.push(db);

    await expect(readPgliteEngine(dataDir)).resolves.toMatchObject({ pglite: pgliteVersion });
  });

  it("snapshots before a failing migration and reports it for the recovery screen", async () => {
    await close(await launch("0.7.0"));
    const db = await launch("0.7.0");
    // Forgetting that a migration ran makes it run again and fail on its own columns.
    const [latest] = await db("knex_migrations").orderBy("name", "desc").limit(1).pluck("name");
    await db("knex_migrations").where({ name: latest }).delete();
    await close(db);

    const failure = await launch("0.8.0").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LocalDatabaseStartupError);
    expect((failure as LocalDatabaseStartupError).failure.reason).toBe("migration");
    await expect(snapshots()).resolves.toHaveLength(1);
    await expect(recordedVersion()).resolves.toBe("0.7.0");
  });

  it("does not snapshot again on a relaunch with the same version", async () => {
    await close(await launch("0.8.0"));
    await close(await launch("0.8.0"));

    await expect(snapshots()).resolves.toEqual([]);
    expect(logged).toEqual([]);
  });

  it("snapshots the data as it was before migrating when the version changes", async () => {
    await close(await launch("0.7.0"));
    const db = await launch("0.7.0");
    await db.schema.createTable("legacy_notes", (table) => table.text("note"));
    await db("legacy_notes").insert({ note: "written by 0.7.0" });
    await close(db);

    const upgraded = await launch("0.8.0");
    await upgraded("legacy_notes").update({ note: "changed by 0.8.0" });

    const [snapshot] = await snapshots();
    expect(snapshot).toMatch(/^before-migration-2026-11-07T\d{2}-\d{2}-00Z$/);
    expect(
      JSON.parse(await readFile(join(backupsDir, snapshot!, "snapshot.json"), "utf8")),
    ).toMatchObject({ fromVersion: "0.7.0", toVersion: "0.8.0" });
    await expect(recordedVersion()).resolves.toBe("0.8.0");
    expect(logged).toEqual([
      expect.stringMatching(
        new RegExp(
          `^Created local data snapshot ${snapshot} .+updated from v0\\.7\\.0 to v0\\.8\\.0`,
        ),
      ),
    ]);

    await expect(readdir(join(backupsDir, snapshot!))).resolves.toContain(pgliteEngineFile);
    const copy = createPgliteDb(join(backupsDir, snapshot!, "pglite"));
    open.push(copy);
    await expect(copy("legacy_notes").select("note")).resolves.toEqual([
      { note: "written by 0.7.0" },
    ]);
  });

  it("snapshots data that has no recorded version before running its migrations", async () => {
    await seedUnmigratedDatabase("before Careerden recorded versions");

    const db = await launch("0.8.0");

    const [snapshot] = await snapshots();
    expect(snapshot).toBeDefined();
    const copy = createPgliteDb(join(backupsDir, snapshot!, "pglite"));
    open.push(copy);
    await expect(copy.schema.hasTable("knex_migrations")).resolves.toBe(false);
    await expect(db.schema.hasTable("knex_migrations")).resolves.toBe(true);
    expect(logged[0]).toMatch(/no app version was recorded/);
  });

  it("snapshots when migrations are pending even though the version did not change", async () => {
    // A launch of this version recorded itself, but its database is behind the schema.
    await seedUnmigratedDatabase("left behind by a failed upgrade");
    await writeLastOpenedVersion(dataDir, "0.8.0");

    const db = await launch("0.8.0");

    await expect(snapshots()).resolves.toHaveLength(1);
    expect(logged[0]).toMatch(/database migration\(s\) are pending/);
    await expect(db.schema.hasTable("knex_migrations")).resolves.toBe(true);
  });

  it("keeps only the three newest snapshots across updates", async () => {
    for (const version of ["0.5.0", "0.6.0", "0.7.0", "0.8.0", "0.9.0"]) {
      await close(await launch(version));
    }

    const kept = await snapshots();
    expect(kept).toHaveLength(3);
    const versions = await Promise.all(
      kept.map(
        async (name) =>
          JSON.parse(await readFile(join(backupsDir, name, "snapshot.json"), "utf8")).fromVersion,
      ),
    );
    expect(versions).toEqual(["0.6.0", "0.7.0", "0.8.0"]);
    expect(
      logged.filter((message) => message.startsWith("Removed old local data snapshot")),
    ).toEqual([expect.stringMatching(/^Removed old local data snapshot before-migration-/)]);
  });

  it("stops before migrating when there is not enough disk space for a snapshot", async () => {
    await seedUnmigratedDatabase("written by 0.7.0");
    await writeLastOpenedVersion(dataDir, "0.7.0");

    await expect(launch("0.8.0", { freeSpace: async () => 1024 })).rejects.toBeInstanceOf(
      LocalDataSnapshotSpaceError,
    );

    await expect(snapshots()).resolves.toEqual([]);
    await expect(recordedVersion()).resolves.toBe("0.7.0");
    const unchanged = createPgliteDb(join(dataDir, "pglite"));
    open.push(unchanged);
    await expect(unchanged.schema.hasTable("knex_migrations")).resolves.toBe(false);
  });

  it("opens a snapshot copied back over the data folder with that version's data", async () => {
    await close(await launch("0.7.0"));
    const db = await launch("0.7.0");
    await db.schema.createTable("legacy_notes", (table) => table.text("note"));
    await db("legacy_notes").insert({ note: "written by 0.7.0" });
    await close(db);
    const upgraded = await launch("0.8.0");
    await upgraded("legacy_notes").update({ note: "changed by 0.8.0" });
    await close(upgraded);
    const [snapshot] = await snapshots();

    await rm(dataDir, { recursive: true });
    await cp(join(backupsDir, snapshot!), dataDir, { recursive: true });
    await expect(recordedVersion()).resolves.toBe("0.7.0");
    const restored = await launch("0.7.0");

    await expect(restored("legacy_notes").select("note")).resolves.toEqual([
      { note: "written by 0.7.0" },
    ]);
    // The restored version matches the record it carries, so no further snapshot is taken.
    await expect(snapshots()).resolves.toEqual([snapshot]);
  });
});

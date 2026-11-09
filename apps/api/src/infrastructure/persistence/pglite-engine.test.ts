import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, pgliteVersion } from "@careerden/infrastructure";
import { pgliteEngineFile, readPgliteEngine, recordPgliteEngine } from "./pglite-engine.js";

describe("PGlite engine record", { timeout: 30_000 }, () => {
  let dataDir: string;
  let db: Knex;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "careerden-engine-"));
    db = createPgliteDb();
  });

  afterEach(async () => {
    await db.destroy();
    await rm(dataDir, { recursive: true, force: true });
  });

  async function writeRecord(contents: string) {
    await writeFile(join(dataDir, pgliteEngineFile), contents, "utf8");
  }

  it("reads no record when none was written or it cannot be parsed", async () => {
    await expect(readPgliteEngine(dataDir)).resolves.toBeUndefined();

    await writeRecord("{ not json");
    await expect(readPgliteEngine(dataDir)).resolves.toBeUndefined();

    await writeRecord(JSON.stringify({ pglite: "0.5.10" }));
    await expect(readPgliteEngine(dataDir)).resolves.toBeUndefined();
  });

  it("records the bundled PGlite release and its PostgreSQL version", async () => {
    const result = await recordPgliteEngine(dataDir, db, new Date("2026-11-09T10:00:00Z"));

    expect(result).toEqual({ changed: true, previous: undefined });
    const record = JSON.parse(await readFile(join(dataDir, pgliteEngineFile), "utf8"));
    expect(record).toEqual({
      pglite: pgliteVersion,
      postgres: expect.stringMatching(/^\d+\.\d+/),
      recordedAt: "2026-11-09T10:00:00.000Z",
    });
  });

  it("leaves a record that already names the bundled engine untouched", async () => {
    await recordPgliteEngine(dataDir, db, new Date("2026-11-09T10:00:00Z"));
    const result = await recordPgliteEngine(dataDir, db, new Date("2026-11-10T10:00:00Z"));

    expect(result.changed).toBe(false);
    await expect(readPgliteEngine(dataDir)).resolves.toMatchObject({
      recordedAt: "2026-11-09T10:00:00.000Z",
    });
  });

  it("replaces a record from another engine and reports what it said", async () => {
    await writeRecord(
      JSON.stringify({ pglite: "0.2.17", postgres: "16.4", recordedAt: "2025-01-01T00:00:00Z" }),
    );

    const result = await recordPgliteEngine(dataDir, db);

    expect(result).toEqual({
      changed: true,
      previous: { pglite: "0.2.17", postgres: "16.4", recordedAt: "2025-01-01T00:00:00Z" },
    });
    await expect(readPgliteEngine(dataDir)).resolves.toMatchObject({ pglite: pgliteVersion });
  });
});

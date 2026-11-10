import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Knex } from "knex";
import { pgliteVersion } from "@careerden/infrastructure";

// Names the engine whose on-disk format `pglite` is in. A PGlite major release can embed a newer
// PostgreSQL that cannot open the previous release's data directory, so a future upgrade reads
// this record to decide whether the data has to be dumped with the old engine and restored with
// the new one. Kept in the data folder, next to `pglite`, so it travels with the data it describes
// when the folder is snapshotted, backed up, or restored.
export const pgliteEngineFile = "pglite-engine.json";

export interface PgliteEngineRecord {
  // The PGlite release that last opened the data, such as "0.5.10".
  pglite: string;
  // The embedded PostgreSQL's server version, such as "17.5".
  postgres: string;
  recordedAt: string;
}

// The recorded engine, or undefined when none was recorded or the record cannot be read.
export async function readPgliteEngine(dataDir: string): Promise<PgliteEngineRecord | undefined> {
  let contents: string;
  try {
    contents = await readFile(join(dataDir, pgliteEngineFile), "utf8");
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(contents);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "pglite" in parsed &&
      typeof parsed.pglite === "string" &&
      parsed.pglite.length > 0 &&
      "postgres" in parsed &&
      typeof parsed.postgres === "string" &&
      parsed.postgres.length > 0
    ) {
      const recordedAt = "recordedAt" in parsed ? parsed.recordedAt : undefined;
      return {
        pglite: parsed.pglite,
        postgres: parsed.postgres,
        recordedAt: typeof recordedAt === "string" ? recordedAt : "",
      };
    }
  } catch {
    // An unreadable record counts as no record.
  }
  return undefined;
}

// Records the bundled engine for the open database `db` in `dataDir`, unless the record already
// names it. Reports whether the record changed and what it said before. Written through a
// temporary file so a crash never leaves a half-written record.
export async function recordPgliteEngine(
  dataDir: string,
  db: Knex,
  now: Date = new Date(),
): Promise<{ changed: boolean; previous: PgliteEngineRecord | undefined }> {
  const postgres = await readPostgresServerVersion(db);
  const previous = await readPgliteEngine(dataDir);
  if (previous?.pglite === pgliteVersion && previous.postgres === postgres) {
    return { changed: false, previous };
  }

  const path = join(dataDir, pgliteEngineFile);
  const record: PgliteEngineRecord = {
    pglite: pgliteVersion,
    postgres,
    recordedAt: now.toISOString(),
  };
  await writeFile(`${path}.tmp`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(`${path}.tmp`, path);
  return { changed: true, previous };
}

async function readPostgresServerVersion(db: Knex): Promise<string> {
  const result = await db.raw<{ rows: Array<{ server_version?: unknown }> }>("show server_version");
  const version = result.rows[0]?.server_version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("The embedded PostgreSQL did not report its version.");
  }
  return version;
}

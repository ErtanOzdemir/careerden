import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { Knex } from "knex";
import {
  createPgliteDb,
  getLatestAppliedPostgresMigration,
  listPostgresMigrations,
  runPostgresMigrations,
  runPostgresMigrationsThrough,
} from "@careerden/infrastructure";
import {
  localBackupFormat,
  localBackupFormatVersion,
  localBackupManifestSchema,
  localBackupTableRowsSchema,
  type LocalBackupManifest,
} from "../../contracts/backup/local-backup-manifest.schema.js";
import { listDataTables, readTableRowsJson, replaceTableRows } from "./postgres-table-rows.js";
import { readZipArchive, writeZipArchive, ZipArchiveError } from "./zip-archive.js";

// Layout of an Unplugged data directory, shared by the live one and an import's staging copy.
export const localDataLayout = { database: "pglite", files: "files" } as const;

const manifestEntry = "manifest.json";
const tableEntry = (table: string) => `tables/${table}.json`;
const filesPrefix = "files/";

// Generous for a personal job tracker; the archive is read into memory to be validated.
const importLimits = {
  maxArchiveBytes: 2 * 1024 ** 3,
  maxUncompressedBytes: 4 * 1024 ** 3,
  maxEntries: 200_000,
};

// A failure the user can act on. Its message is shown as is, so it never includes file contents.
export class LocalBackupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LocalBackupError";
  }
}

export interface ExportLocalDataOptions {
  // The live database; its rows are read in one transaction for a consistent copy.
  db: Knex;
  filesDir: string;
  outputPath: string;
  appVersion: string;
  now?: () => Date;
}

// Writes the database, one JSON file per table, and every stored file into one zip. AI keys live
// outside the data directory and are never part of it.
export async function exportLocalData(
  options: ExportLocalDataOptions,
): Promise<LocalBackupManifest> {
  const lastMigration = await getLatestAppliedPostgresMigration(options.db);
  if (!lastMigration) throw new LocalBackupError("The local database has not been set up yet.");

  const tables = await options.db.transaction(async (trx) => {
    const names = await listDataTables(trx);
    const dumped: Array<{ name: string; json: string; rows: number }> = [];
    for (const name of names) dumped.push({ name, ...(await readTableRowsJson(trx, name)) });
    return dumped;
  });
  const files = await listStoredFiles(options.filesDir);
  const manifest: LocalBackupManifest = {
    format: localBackupFormat,
    formatVersion: localBackupFormatVersion,
    schemaVersion: listPostgresMigrations().indexOf(lastMigration) + 1,
    lastMigration,
    appVersion: options.appVersion,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    tables: tables.map(({ name, rows }) => ({ name, rows })),
    files: files.length,
  };

  await writeZipArchive(options.outputPath, async (archive) => {
    archive.addText(manifestEntry, `${JSON.stringify(manifest, null, 2)}\n`);
    for (const table of tables) archive.addText(tableEntry(table.name), table.json);
    for (const file of files) {
      await archive.addFile(`${filesPrefix}${file.entryName}`, file.path);
    }
  });
  return manifest;
}

export interface PrepareLocalDataImportOptions {
  archivePath: string;
  // Recreated from scratch; on success it holds a complete data directory ready to swap in.
  stagingDir: string;
}

// Validates an archive and restores it into `stagingDir` without touching the live data. The
// staging database is migrated to the archive's schema, loaded, and then migrated to the latest
// schema, so archives from older versions are upgraded by the same migrations as a live install.
export async function prepareLocalDataImport(
  options: PrepareLocalDataImportOptions,
): Promise<LocalBackupManifest> {
  const entries = await readArchive(options.archivePath);
  const manifest = parseManifest(entries);
  const rowsByTable = parseTables(entries, manifest);
  const files = [...entries].filter(([name]) => name.startsWith(filesPrefix));
  if (files.length !== manifest.files) {
    throw damaged("The number of stored files does not match its manifest.");
  }

  await rm(options.stagingDir, { recursive: true, force: true });
  await mkdir(options.stagingDir, { recursive: true });
  try {
    await restoreDatabase(
      join(options.stagingDir, localDataLayout.database),
      manifest,
      rowsByTable,
    );
    const filesDir = join(options.stagingDir, localDataLayout.files);
    await mkdir(filesDir, { recursive: true });
    for (const [name, body] of files) {
      const path = join(filesDir, ...name.slice(filesPrefix.length).split("/"));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    }
    return manifest;
  } catch (error) {
    await rm(options.stagingDir, { recursive: true, force: true });
    throw error;
  }
}

async function readArchive(archivePath: string): Promise<Map<string, Uint8Array>> {
  try {
    return await readZipArchive(archivePath, importLimits);
  } catch (error) {
    if (error instanceof ZipArchiveError) {
      throw new LocalBackupError(`This file is not a valid Careerden backup. ${error.message}`, {
        cause: error,
      });
    }
    throw new LocalBackupError("The backup file could not be read.", { cause: error });
  }
}

function parseManifest(entries: Map<string, Uint8Array>): LocalBackupManifest {
  const raw = parseJsonEntry(entries, manifestEntry, "It has no readable manifest.");
  const header = asRecord(raw);
  if (header?.format !== localBackupFormat) {
    throw new LocalBackupError("This file is not a Careerden Unplugged backup.");
  }
  // Checked before the full schema so a newer layout is reported as newer, not as damaged.
  if (typeof header.formatVersion === "number" && header.formatVersion > localBackupFormatVersion) {
    throw newerVersion(header.appVersion);
  }

  const parsed = localBackupManifestSchema.safeParse(raw);
  if (!parsed.success) throw damaged("Its manifest is incomplete.");
  const manifest = parsed.data;

  const migrations = listPostgresMigrations();
  if (!migrations.includes(manifest.lastMigration)) {
    const latest = migrations.at(-1) ?? "";
    if (manifest.lastMigration > latest || manifest.schemaVersion > migrations.length) {
      throw newerVersion(manifest.appVersion);
    }
    throw damaged("It was made with a database version this app does not recognize.");
  }
  return manifest;
}

function parseTables(
  entries: Map<string, Uint8Array>,
  manifest: LocalBackupManifest,
): Map<string, string> {
  const rowsByTable = new Map<string, string>();
  for (const table of manifest.tables) {
    if (rowsByTable.has(table.name)) throw damaged(`It lists the ${table.name} table twice.`);
    const name = tableEntry(table.name);
    const rows = localBackupTableRowsSchema.safeParse(
      parseJsonEntry(entries, name, `The ${table.name} table is missing or unreadable.`),
    );
    if (!rows.success || rows.data.length !== table.rows) {
      throw damaged(`The ${table.name} table does not match its manifest.`);
    }
    // Keep the archived text: re-serializing parsed numbers could change numeric values.
    rowsByTable.set(table.name, entryText(entries, name));
  }

  for (const name of entries.keys()) {
    if (name.startsWith("tables/") && !manifest.tables.some((t) => tableEntry(t.name) === name)) {
      throw damaged("It contains a table its manifest does not list.");
    }
  }
  return rowsByTable;
}

async function restoreDatabase(
  databaseDir: string,
  manifest: LocalBackupManifest,
  rowsByTable: Map<string, string>,
): Promise<void> {
  const db = createPgliteDb(databaseDir);
  try {
    await runPostgresMigrationsThrough(db, manifest.lastMigration);
    const tables = await listDataTables(db);
    const archived = [...rowsByTable.keys()].sort();
    if (tables.length !== archived.length || tables.some((name, i) => name !== archived[i])) {
      throw damaged("Its tables do not match the database version it claims.");
    }

    try {
      await db.transaction((trx) => replaceTableRows(trx, rowsByTable));
    } catch (error) {
      throw damaged("Its data could not be restored.", error);
    }
    await runPostgresMigrations(db);
  } finally {
    await db.destroy();
  }
}

async function listStoredFiles(
  filesDir: string,
): Promise<Array<{ entryName: string; path: string }>> {
  let entries: Dirent[];
  try {
    entries = await readdir(filesDir, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return [];
    throw error;
  }

  return (
    entries
      // Interrupted atomic writes leave *.tmp files behind; nothing references them.
      .filter((entry) => entry.isFile() && !entry.name.endsWith(".tmp"))
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return { entryName: relative(filesDir, path).split(sep).join("/"), path };
      })
      .sort((a, b) => a.entryName.localeCompare(b.entryName))
  );
}

function parseJsonEntry(entries: Map<string, Uint8Array>, name: string, problem: string): unknown {
  if (!entries.has(name)) throw damaged(problem);
  try {
    return JSON.parse(entryText(entries, name)) as unknown;
  } catch (error) {
    throw damaged(problem, error);
  }
}

function entryText(entries: Map<string, Uint8Array>, name: string): string {
  return Buffer.from(entries.get(name) ?? new Uint8Array(0)).toString("utf8");
}

function damaged(detail: string, cause?: unknown): LocalBackupError {
  return new LocalBackupError(
    `This backup is damaged and cannot be imported. ${detail}`,
    cause === undefined ? undefined : { cause },
  );
}

function newerVersion(appVersion: unknown): LocalBackupError {
  const made = typeof appVersion === "string" ? ` (${appVersion.slice(0, 40)})` : "";
  return new LocalBackupError(
    `This backup was made by a newer version of Careerden Unplugged${made}. Update the app, then import it again.`,
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

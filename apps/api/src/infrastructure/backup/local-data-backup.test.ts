import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalFileStorage,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
  createPgliteDb,
  getLatestAppliedPostgresMigration,
  listPostgresMigrations,
  runPostgresMigrations,
  runPostgresMigrationsThrough,
} from "@careerden/infrastructure";
import { exportLocalData, LocalBackupError, prepareLocalDataImport } from "./local-data-backup.js";

const createdAt = new Date("2026-11-01T09:30:00.000Z");

// Exports a seeded PGlite data directory and restores it into a fresh one, as moving to a new
// device would. Starting the WASM database takes seconds under a parallel run.
describe("local data backup", { timeout: 60_000 }, () => {
  let root: string;
  const databases: Knex[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-backup-"));
  });

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
    await rm(root, { recursive: true, force: true });
  });

  function openDb(dir: string): Knex {
    const db = createPgliteDb(dir);
    databases.push(db);
    return db;
  }

  async function seed(db: Knex, filesDir: string) {
    await db("user").insert({ id: "local-user", name: "", email: "" });
    const profile = await new PostgresUserProfileRepository(db).createForUserId("local-user", {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [{ company: "Analytical Engines", title: "Engineer" }],
    } as never);
    const application = await new PostgresJobApplicationRepository(db).create({
      profileId: profile.id,
      companyName: "Acme",
      roleTitle: "Staff Engineer",
      tags: ["remote", "typescript"],
    });
    const storage = new LocalFileStorage({
      rootDir: filesDir,
      signingKey: "test-signing-key",
      urlPathPrefix: "/api/files",
    });
    const stored = await storage.put({
      fileName: "Ada Lovelace CV.pdf",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.7 cv"),
    });
    await db("generated_documents").insert({
      id: "document-1",
      job_application_id: application.id,
      kind: "cv",
      format: "pdf",
      file_id: stored.id,
      file_name: stored.fileName,
      content_type: stored.contentType,
      created_at: createdAt,
    });
    return { profile, application, fileId: stored.id };
  }

  async function exportSeeded(options: { throughMigration?: string } = {}) {
    const dataDir = join(root, "device-a");
    const filesDir = join(dataDir, "files");
    await mkdir(dataDir, { recursive: true });
    const db = openDb(join(dataDir, "pglite"));
    if (options.throughMigration) await runPostgresMigrationsThrough(db, options.throughMigration);
    else await runPostgresMigrations(db);
    const seeded = await seed(db, filesDir);
    // A leftover from an interrupted atomic write.
    await writeFile(join(filesDir, "orphan.pdf.123.tmp"), "partial");
    const archivePath = join(root, "backup.zip");
    const manifest = await exportLocalData({
      db,
      filesDir,
      outputPath: archivePath,
      appVersion: "0.7.0",
      now: () => createdAt,
    });
    return { ...seeded, archivePath, manifest };
  }

  async function rewriteArchive(
    archivePath: string,
    change: (entries: Record<string, Uint8Array>) => void,
  ) {
    const entries = unzipSync(await readFile(archivePath));
    change(entries);
    await writeFile(archivePath, zipSync(entries));
  }

  it("writes a manifest, one JSON file per table, and the stored files", async () => {
    const { archivePath, manifest, fileId } = await exportSeeded();
    const entries = unzipSync(await readFile(archivePath));
    const migrations = listPostgresMigrations();

    expect(manifest).toMatchObject({
      format: "careerden-unplugged-backup",
      formatVersion: 1,
      schemaVersion: migrations.length,
      lastMigration: migrations.at(-1),
      appVersion: "0.7.0",
      createdAt: createdAt.toISOString(),
      files: 2,
    });
    expect(JSON.parse(strFromU8(entries["manifest.json"]!))).toEqual(manifest);
    expect(manifest.tables).toEqual(
      expect.arrayContaining([
        { name: "user_profiles", rows: 1 },
        { name: "job_applications", rows: 1 },
        { name: "generated_documents", rows: 1 },
        { name: "notifications", rows: 0 },
        { name: "job_application_follow_ups", rows: 0 },
      ]),
    );
    expect(manifest.tables.map((table) => table.name)).not.toContain("knex_migrations");
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining([
        "tables/user_profiles.json",
        `files/${fileId}`,
        `files/${fileId}.meta.json`,
      ]),
    );
    expect(Object.keys(entries).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(strFromU8(entries[`files/${fileId}`]!)).toBe("%PDF-1.7 cv");
    expect(Object.keys(entries).some((name) => name.includes("ai-credentials"))).toBe(false);
  });

  it("restores the database and files into a fresh data directory", async () => {
    const { archivePath, profile, application, fileId } = await exportSeeded();
    const stagingDir = join(root, "device-b", "data.import");

    await prepareLocalDataImport({ archivePath, stagingDir });

    const db = openDb(join(stagingDir, "pglite"));
    await runPostgresMigrations(db);
    await expect(
      new PostgresUserProfileRepository(db).findByUserId("local-user"),
    ).resolves.toMatchObject({
      id: profile.id,
      fullName: "Ada Lovelace",
      skills: ["TypeScript"],
      experience: [{ company: "Analytical Engines", title: "Engineer" }],
      createdAt: profile.createdAt,
    });
    await expect(
      new PostgresJobApplicationRepository(db).findById(application.id),
    ).resolves.toMatchObject({
      createdAt: application.createdAt,
      tracking: { companyName: "Acme", tags: ["remote", "typescript"] },
    });
    await expect(db("generated_documents").first()).resolves.toMatchObject({
      id: "document-1",
      file_id: fileId,
      created_at: createdAt,
    });
    const storage = new LocalFileStorage({
      rootDir: join(stagingDir, "files"),
      signingKey: "another-key",
      urlPathPrefix: "/api/files",
    });
    await expect(storage.get(fileId)).resolves.toMatchObject({
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.7 cv"),
    });
  });

  it("upgrades an archive from an older schema with the remaining migrations", async () => {
    const migrations = listPostgresMigrations();
    // The schema just before the onboarding migration, whose backfill this test observes; later
    // migrations must not move it.
    const older =
      migrations[migrations.indexOf("20261031000000_profile_onboarding_state.cjs") - 1]!;
    const { archivePath, manifest, profile } = await exportSeeded({ throughMigration: older });
    expect(manifest).toMatchObject({
      lastMigration: older,
      schemaVersion: migrations.indexOf(older) + 1,
    });
    const stagingDir = join(root, "staging");

    await prepareLocalDataImport({ archivePath, stagingDir });

    const db = openDb(join(stagingDir, "pglite"));
    await expect(getLatestAppliedPostgresMigration(db)).resolves.toBe(migrations.at(-1));
    const restored = await new PostgresUserProfileRepository(db).findById(profile.id);
    // The onboarding migration marks profiles that predate it as onboarded.
    expect(restored?.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it("rejects an archive from a newer schema without touching the staging directory", async () => {
    const { archivePath } = await exportSeeded();
    await rewriteArchive(archivePath, (entries) => {
      const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as Record<string, unknown>;
      entries["manifest.json"] = strToU8(
        JSON.stringify({
          ...manifest,
          appVersion: "9.0.0",
          schemaVersion: 99,
          lastMigration: "29990101000000_from_the_future.cjs",
        }),
      );
    });
    const stagingDir = join(root, "staging");

    await expect(prepareLocalDataImport({ archivePath, stagingDir })).rejects.toThrow(
      "This backup was made by a newer version of Careerden Unplugged (9.0.0).",
    );
    await expect(readdir(stagingDir)).rejects.toThrow();
  });

  it("rejects an archive in a newer format", async () => {
    const { archivePath } = await exportSeeded();
    await rewriteArchive(archivePath, (entries) => {
      entries["manifest.json"] = strToU8(
        JSON.stringify({ format: "careerden-unplugged-backup", formatVersion: 2 }),
      );
    });

    await expect(
      prepareLocalDataImport({ archivePath, stagingDir: join(root, "staging") }),
    ).rejects.toThrow("newer version");
  });

  it.each([
    ["is not a zip", async (path: string) => writeFile(path, "not a zip at all")],
    [
      "has no manifest",
      async (path: string) => writeFile(path, zipSync({ "tables/user.json": strToU8("[]") })),
    ],
  ])("rejects a file that %s", async (_label, write) => {
    const archivePath = join(root, "broken.zip");
    await write(archivePath);

    const error = await prepareLocalDataImport({
      archivePath,
      stagingDir: join(root, "staging"),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LocalBackupError);
    expect((error as Error).message).toMatch(/not a valid Careerden backup|damaged/);
  });

  it("rejects a table whose rows do not match the manifest", async () => {
    const { archivePath } = await exportSeeded();
    await rewriteArchive(archivePath, (entries) => {
      entries["tables/job_applications.json"] = strToU8("[]");
    });

    await expect(
      prepareLocalDataImport({ archivePath, stagingDir: join(root, "staging") }),
    ).rejects.toThrow("The job_applications table does not match its manifest.");
  });

  it("rejects rows that violate the schema and removes the partial staging copy", async () => {
    const { archivePath } = await exportSeeded();
    await rewriteArchive(archivePath, (entries) => {
      const rows = JSON.parse(strFromU8(entries["tables/user_profiles.json"]!)) as Array<
        Record<string, unknown>
      >;
      entries["tables/user_profiles.json"] = strToU8(
        JSON.stringify(rows.map((row) => ({ ...row, full_name: null }))),
      );
    });
    const stagingDir = join(root, "staging");

    await expect(prepareLocalDataImport({ archivePath, stagingDir })).rejects.toThrow(
      "Its data could not be restored.",
    );
    await expect(readdir(stagingDir)).rejects.toThrow();
  });

  it("rejects entries that would escape the files directory", async () => {
    const { archivePath } = await exportSeeded();
    await rewriteArchive(archivePath, (entries) => {
      entries["files/../../escape.txt"] = strToU8("nope");
    });
    await mkdir(join(root, "staging"), { recursive: true });

    await expect(
      prepareLocalDataImport({ archivePath, stagingDir: join(root, "staging") }),
    ).rejects.toThrow("Unsafe archive entry name");
    await expect(readFile(join(root, "escape.txt"))).rejects.toThrow();
  });
});

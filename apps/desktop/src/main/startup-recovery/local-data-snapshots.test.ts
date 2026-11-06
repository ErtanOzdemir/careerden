import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDatabaseStartupError, createLocalApiRuntime } from "@careerden/api-app/local";
import { DirectoryLocalDataSnapshots, LocalDataRestoreError } from "./local-data-snapshots.js";

describe("DirectoryLocalDataSnapshots", () => {
  let root: string;
  let backupsDir: string;
  let dataDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-snapshots-"));
    backupsDir = join(root, "backups");
    dataDir = join(root, "data");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function snapshots() {
    return new DirectoryLocalDataSnapshots({
      backupsDir,
      dataDir,
      now: () => new Date("2026-11-06T12:30:45.123Z"),
    });
  }

  async function writeDataFolder(directory: string, marker: string) {
    await mkdir(join(directory, "pglite"), { recursive: true });
    await mkdir(join(directory, "files"), { recursive: true });
    await writeFile(join(directory, "pglite", "marker"), marker);
  }

  it("lists nothing before any snapshot was taken", async () => {
    await expect(snapshots().list()).resolves.toEqual([]);
  });

  it("lists data folder copies newest first and skips everything else", async () => {
    await writeDataFolder(join(backupsDir, "before-migration-2026-11-01T08-00-00Z"), "older");
    await writeDataFolder(join(backupsDir, "before-migration-2026-11-05T09-15-00Z"), "newer");
    // Pre-import backups are zip archives, restored through the import flow instead.
    await writeFile(join(backupsDir, "before-import-2026-11-04T10-00-00Z.zip"), "zip");
    // Holds data a restore replaced, which usually did not open.
    await writeDataFolder(join(backupsDir, "before-restore-2026-11-06T00-00-00Z"), "broken");
    await mkdir(join(backupsDir, "before-migration-2026-11-03T00-00-00Z"));
    await writeDataFolder(join(backupsDir, "notes"), "unrelated");

    await expect(snapshots().list()).resolves.toEqual([
      {
        id: "before-migration-2026-11-05T09-15-00Z",
        kind: "before-migration",
        createdAt: "2026-11-05T09:15:00.000Z",
      },
      {
        id: "before-migration-2026-11-01T08-00-00Z",
        kind: "before-migration",
        createdAt: "2026-11-01T08:00:00.000Z",
      },
    ]);
  });

  it("copies a snapshot over the data folder and keeps the replaced data", async () => {
    const id = "before-migration-2026-11-05T09-15-00Z";
    await writeDataFolder(join(backupsDir, id), "snapshot");
    await writeDataFolder(dataDir, "broken");

    await snapshots().restore(id);

    await expect(readFile(join(dataDir, "pglite", "marker"), "utf8")).resolves.toBe("snapshot");
    await expect(readFile(join(backupsDir, id, "pglite", "marker"), "utf8")).resolves.toBe(
      "snapshot",
    );
    await expect(
      readFile(join(backupsDir, "before-restore-2026-11-06T12-30-45Z", "pglite", "marker"), "utf8"),
    ).resolves.toBe("broken");
  });

  it("restores into a missing data folder", async () => {
    const id = "before-migration-2026-11-05T09-15-00Z";
    await writeDataFolder(join(backupsDir, id), "snapshot");

    await snapshots().restore(id);

    await expect(readFile(join(dataDir, "pglite", "marker"), "utf8")).resolves.toBe("snapshot");
  });

  it("refuses ids that are not listed snapshots", async () => {
    await writeDataFolder(dataDir, "current");
    await writeDataFolder(join(root, "elsewhere"), "outside");

    for (const id of ["../elsewhere", "before-restore-2026-11-06T00-00-00Z", dataDir]) {
      await expect(snapshots().restore(id)).rejects.toThrow(LocalDataRestoreError);
    }
    await expect(readFile(join(dataDir, "pglite", "marker"), "utf8")).resolves.toBe("current");
    await expect(readdir(root)).resolves.not.toContain("backups");
  });

  it("opens the app's data again after restoring over data that would not open", {
    timeout: 60_000,
  }, async () => {
    const runtimeOptions = (directory: string) => ({
      dataDir: directory,
      sessionToken: "token",
      pdfRenderer: { htmlToPdf: async () => Buffer.from("%PDF") },
      aiProviderSelection: { current: async () => null },
    });
    const id = "before-migration-2026-11-05T09-15-00Z";
    const healthy = await createLocalApiRuntime(runtimeOptions(join(backupsDir, id)));
    await healthy.db("user").where({ id: "local-user" }).update({ name: "From the snapshot" });
    await healthy.close();
    const broken = await createLocalApiRuntime(runtimeOptions(dataDir));
    await broken.close();
    await writeFile(join(dataDir, "pglite", "PG_VERSION"), "99\n");
    await expect(createLocalApiRuntime(runtimeOptions(dataDir))).rejects.toThrow(
      LocalDatabaseStartupError,
    );

    await snapshots().restore(id);

    const restored = await createLocalApiRuntime(runtimeOptions(dataDir));
    try {
      await expect(restored.db("user").where({ id: "local-user" }).first()).resolves.toMatchObject(
        { name: "From the snapshot" },
      );
    } finally {
      await restored.close();
    }
  });
});

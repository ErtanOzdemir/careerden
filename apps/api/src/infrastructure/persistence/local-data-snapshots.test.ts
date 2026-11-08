import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalDataSnapshotSpaceError,
  createLocalDataSnapshot,
  pruneLocalDataSnapshots,
  snapshotHeadroomBytes,
} from "./local-data-snapshots.js";

const plentyOfSpace = async () => Number.MAX_SAFE_INTEGER;

describe("local data snapshots", () => {
  let root: string;
  let dataDir: string;
  let backupsDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-snapshots-"));
    dataDir = join(root, "data");
    backupsDir = join(root, "backups");
    await mkdir(join(dataDir, "pglite", "base"), { recursive: true });
    await writeFile(join(dataDir, "pglite", "base", "1"), "database page");
    await mkdir(join(dataDir, "files", "documents"), { recursive: true });
    await writeFile(join(dataDir, "files", "documents", "cv.pdf"), "%PDF");
    await writeFile(join(dataDir, "last-opened-version.json"), '{"version":"0.7.0"}');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function snapshot(at: string, overrides: { freeSpace?: () => Promise<number> } = {}) {
    return createLocalDataSnapshot({
      dataDir,
      backupsDir,
      fromVersion: "0.7.0",
      toVersion: "0.8.0",
      reason: "the app was updated",
      now: () => new Date(at),
      freeSpace: overrides.freeSpace ?? plentyOfSpace,
    });
  }

  it("copies the database, stored files, and version record with a manifest", async () => {
    const created = await snapshot("2026-11-07T10:15:30.123Z");

    expect(created.id).toBe("before-migration-2026-11-07T10-15-30Z");
    expect(created.path).toBe(join(backupsDir, created.id));
    expect(created.sizeBytes).toBeGreaterThan(0);
    await expect(readFile(join(created.path, "pglite", "base", "1"), "utf8")).resolves.toBe(
      "database page",
    );
    await expect(
      readFile(join(created.path, "files", "documents", "cv.pdf"), "utf8"),
    ).resolves.toBe("%PDF");
    await expect(readFile(join(created.path, "last-opened-version.json"), "utf8")).resolves.toBe(
      '{"version":"0.7.0"}',
    );
    expect(JSON.parse(await readFile(join(created.path, "snapshot.json"), "utf8"))).toEqual({
      kind: "before-migration",
      createdAt: "2026-11-07T10:15:30.123Z",
      fromVersion: "0.7.0",
      toVersion: "0.8.0",
      reason: "the app was updated",
    });
    await expect(readdir(backupsDir)).resolves.toEqual([created.id]);
  });

  it("copies only what exists, such as a database without stored files", async () => {
    await rm(join(dataDir, "files"), { recursive: true });

    const created = await snapshot("2026-11-07T10:15:30Z");

    await expect(readdir(created.path)).resolves.toEqual(
      expect.arrayContaining(["pglite", "snapshot.json"]),
    );
    await expect(readdir(created.path)).resolves.not.toContain("files");
  });

  it("refuses to copy without room for the copy and some headroom", async () => {
    const error = await snapshot("2026-11-07T10:15:30Z", {
      freeSpace: async () => snapshotHeadroomBytes,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LocalDataSnapshotSpaceError);
    expect((error as LocalDataSnapshotSpaceError).message).toMatch(
      /needs .+ of free disk space, but only 100\.0 MB is available.+has not been changed/,
    );
    await expect(readdir(backupsDir)).resolves.toEqual([]);
  });

  it("keeps the newest snapshots and removes older ones and interrupted copies", async () => {
    for (const day of ["01", "02", "03", "04", "05"]) {
      await snapshot(`2026-11-${day}T08:00:00Z`);
    }
    await mkdir(join(backupsDir, ".partial-before-migration-2026-11-06T08-00-00Z"));
    await mkdir(join(backupsDir, "before-restore-2026-10-01T08-00-00Z"));

    const removed = await pruneLocalDataSnapshots({ backupsDir, keep: 3 });

    expect(removed.sort()).toEqual([
      ".partial-before-migration-2026-11-06T08-00-00Z",
      "before-migration-2026-11-01T08-00-00Z",
      "before-migration-2026-11-02T08-00-00Z",
    ]);
    expect((await readdir(backupsDir)).sort()).toEqual([
      "before-migration-2026-11-03T08-00-00Z",
      "before-migration-2026-11-04T08-00-00Z",
      "before-migration-2026-11-05T08-00-00Z",
      "before-restore-2026-10-01T08-00-00Z",
    ]);
  });

  it("prunes nothing when there is no backups folder yet", async () => {
    await expect(pruneLocalDataSnapshots({ backupsDir, keep: 3 })).resolves.toEqual([]);
  });
});

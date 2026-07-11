import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalFileStorage } from "./local-file.storage.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("LocalFileStorage", () => {
  it("deletes a stored file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "link2cv-storage-"));
    temporaryDirectories.push(directory);
    const storage = new LocalFileStorage(directory);
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    await storage.delete(stored.id);

    await expect(storage.get(stored.id)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses a caller-supplied deterministic key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "link2cv-storage-"));
    temporaryDirectories.push(directory);
    const storage = new LocalFileStorage(directory);
    const stored = await storage.put({
      key: "jobs/job-1/attempt-1/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    expect(stored.id).toBe("jobs/job-1/attempt-1/cv.pdf");
    await expect(storage.get(stored.id)).resolves.toMatchObject({ id: stored.id });
  });

  it("rejects file IDs outside the storage root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "link2cv-storage-"));
    temporaryDirectories.push(directory);
    const storage = new LocalFileStorage(directory);

    await expect(storage.delete("../outside.pdf")).rejects.toThrow("Invalid file ID");
  });
});

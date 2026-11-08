import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeEntryName, readZipArchive, writeZipArchive } from "./zip-archive.js";

const limits = { maxArchiveBytes: 1024 * 1024, maxUncompressedBytes: 1024 * 1024, maxEntries: 10 };

describe("zip archive", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-zip-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips text and streamed files", async () => {
    const source = join(root, "source.pdf");
    await writeFile(source, Buffer.alloc(200_000, 7));
    const archivePath = join(root, "out.zip");

    await writeZipArchive(archivePath, async (archive) => {
      archive.addText("manifest.json", '{"ok":true}');
      await archive.addFile("files/a/source.pdf", source);
    });
    const entries = await readZipArchive(archivePath, limits);

    expect([...entries.keys()]).toEqual(["manifest.json", "files/a/source.pdf"]);
    expect(Buffer.from(entries.get("manifest.json")!).toString()).toBe('{"ok":true}');
    expect(Buffer.from(entries.get("files/a/source.pdf")!)).toEqual(Buffer.alloc(200_000, 7));
    expect(await readdir(root)).toEqual(
      expect.not.arrayContaining([expect.stringMatching(/partial/)]),
    );
  });

  it("leaves no archive behind when building it fails", async () => {
    const archivePath = join(root, "out.zip");

    await expect(
      writeZipArchive(archivePath, async (archive) => {
        archive.addText("manifest.json", "{}");
        await archive.addFile("files/missing.pdf", join(root, "missing.pdf"));
      }),
    ).rejects.toThrow();

    expect(await readdir(root)).toEqual([]);
  });

  it("rejects archives over the declared size or entry limits", async () => {
    const archivePath = join(root, "big.zip");
    await writeFile(archivePath, zipSync({ "a.txt": new Uint8Array(2 * 1024 * 1024) }));

    await expect(readZipArchive(archivePath, limits)).rejects.toThrow(
      "expands beyond the supported maximum",
    );

    const many = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [`f${index}.txt`, strToU8("x")]),
    );
    await writeFile(archivePath, zipSync(many));
    await expect(readZipArchive(archivePath, limits)).rejects.toThrow("too many files");
  });

  it("rejects files that are not zips", async () => {
    const archivePath = join(root, "plain.zip");
    await writeFile(archivePath, "hello");

    await expect(readZipArchive(archivePath, limits)).rejects.toThrow("not a readable zip archive");
  });

  it.each(["../escape", "files/../../escape", "/absolute", "C:/windows", "a\\b", "a//b", ""])(
    "rejects the unsafe entry name %j",
    (name) => {
      expect(() => assertSafeEntryName(name)).toThrow("Unsafe archive entry name");
    },
  );
});

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileStorage } from "./local-file.storage.js";

describe("LocalFileStorage", () => {
  let rootDir: string;
  let now: Date;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "careerden-files-"));
    now = new Date("2026-10-29T10:00:00.000Z");
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  function createStorage(signingKey = "signing-key") {
    return new LocalFileStorage({
      rootDir,
      signingKey,
      urlPathPrefix: "/api/files",
      urlTtlMs: 60_000,
      now: () => now,
    });
  }

  it("stores and reads back a file under a generated id", async () => {
    const storage = createStorage();

    const stored = await storage.put({
      fileName: "Ada CV.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    expect(stored).toMatchObject({ fileName: "Ada CV.pdf", contentType: "application/pdf", size: 3 });
    expect(stored.id).toMatch(/^[0-9a-f-]{36}\/Ada-CV\.pdf$/);
    await expect(storage.get(stored.id)).resolves.toMatchObject({
      id: stored.id,
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });
  });

  it("overwrites an explicit key and keeps its content type", async () => {
    const storage = createStorage();
    const key = "job-applications/application-1/logo.png";

    await storage.put({ key, fileName: "logo.png", contentType: "image/png", body: Buffer.from("a") });
    await storage.put({ key, fileName: "logo.png", contentType: "image/png", body: Buffer.from("b") });

    await expect(storage.get(key)).resolves.toMatchObject({
      contentType: "image/png",
      body: Buffer.from("b"),
    });
    expect(await readdir(join(rootDir, "job-applications/application-1"))).toEqual([
      "logo.png",
      "logo.png.meta.json",
    ]);
  });

  it("deletes files idempotently", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    await storage.delete(stored.id);
    await storage.delete(stored.id);

    await expect(storage.get(stored.id)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("finds stored files and resolves null for missing ones", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    await expect(storage.find(stored.id)).resolves.toMatchObject({ body: Buffer.from("pdf") });
    await storage.delete(stored.id);
    await expect(storage.find(stored.id)).resolves.toBeNull();
    await expect(storage.find("../escape.pdf")).rejects.toThrow("Invalid file id");
  });

  it("rejects ids that escape the storage root", async () => {
    const storage = createStorage();

    for (const fileId of ["../outside.pdf", "a/../../outside.pdf", "/etc/passwd", "cv.pdf.meta.json"]) {
      await expect(storage.get(fileId)).rejects.toThrow(/Invalid file id/);
      await expect(storage.delete(fileId)).rejects.toThrow(/Invalid file id/);
    }
  });

  it("signs download URLs that verify until they expire", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });

    const url = new URL(await storage.getSignedUrl(stored.id), "careerden://app");
    const params = {
      fileId: decodeURIComponent(url.pathname.replace(/^\/api\/files\//, "")),
      expires: url.searchParams.get("expires") ?? "",
      signature: url.searchParams.get("signature") ?? "",
    };

    expect(params.fileId).toBe(stored.id);
    expect(storage.verifySignedUrl(params)).toBe(true);
    expect(storage.verifySignedUrl({ ...params, fileId: "other/cv.pdf" })).toBe(false);
    expect(storage.verifySignedUrl({ ...params, expires: String(Number(params.expires) + 1) })).toBe(
      false,
    );
    expect(createStorage("other-key").verifySignedUrl(params)).toBe(false);

    now = new Date(Number(params.expires));
    expect(storage.verifySignedUrl(params)).toBe(false);
  });

  it("refuses to sign a URL for a missing file", async () => {
    await expect(createStorage().getSignedUrl("missing/cv.pdf")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

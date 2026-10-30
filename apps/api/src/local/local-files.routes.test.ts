import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileStorage } from "@careerden/infrastructure";
import { createLocalFileRouter } from "./local-files.routes.js";

describe("createLocalFileRouter", () => {
  let rootDir: string;
  let server: Server | undefined;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "careerden-file-route-"));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
    await rm(rootDir, { recursive: true, force: true });
  });

  async function serve(storage: LocalFileStorage): Promise<string> {
    const app = express();
    app.use("/files", createLocalFileRouter(storage));
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", () => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function createStorage() {
    return new LocalFileStorage({ rootDir, signingKey: "key", urlPathPrefix: "/api/files" });
  }

  it("serves a file through its signed URL", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "logo.png",
      contentType: "image/png",
      body: Buffer.from("png"),
    });
    const baseUrl = await serve(storage);
    const path = (await storage.getSignedUrl(stored.id)).replace(/^\/api/, "");

    const response = await fetch(`${baseUrl}${path}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from("png"));
  });

  it("rejects missing or tampered signatures", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });
    const baseUrl = await serve(storage);
    const path = (await storage.getSignedUrl(stored.id)).replace(/^\/api/, "");

    const [unsigned, tampered] = await Promise.all([
      fetch(`${baseUrl}/files/${encodeURIComponent(stored.id)}`),
      fetch(`${baseUrl}${path.replace(/signature=[^&]+/, "signature=forged")}`),
    ]);

    expect(unsigned.status).toBe(403);
    expect(tampered.status).toBe(403);
  });

  it("returns 404 for a signed link whose file was deleted", async () => {
    const storage = createStorage();
    const stored = await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
    });
    const baseUrl = await serve(storage);
    const path = (await storage.getSignedUrl(stored.id)).replace(/^\/api/, "");
    await storage.delete(stored.id);

    expect((await fetch(`${baseUrl}${path}`)).status).toBe(404);
  });
});

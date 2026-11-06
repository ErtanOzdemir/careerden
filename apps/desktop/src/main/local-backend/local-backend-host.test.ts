import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalBackendEvent } from "./local-backend-messages.js";
import type {
  CreateLocalBackendRuntime,
  LocalBackendBackupManifest,
  LocalBackendParentPort,
  LocalBackendRuntime,
  PrepareLocalBackupImport,
} from "./local-backend-host.js";
import { startLocalBackendHost } from "./local-backend-host.js";

class FakeParentPort extends EventEmitter implements LocalBackendParentPort {
  readonly sent: LocalBackendEvent[] = [];

  postMessage(message: LocalBackendEvent): void {
    this.sent.push(message);
    this.emit("sent", message);
  }

  command(data: unknown): void {
    this.emit("message", { data, ports: [] });
  }

  next<T extends LocalBackendEvent["type"]>(
    type: T,
  ): Promise<Extract<LocalBackendEvent, { type: T }>> {
    const existing = this.sent.find((message) => message.type === type);
    if (existing) return Promise.resolve(existing as Extract<LocalBackendEvent, { type: T }>);
    return new Promise((resolve) => {
      const listener = (message: LocalBackendEvent) => {
        if (message.type !== type) return;
        this.off("sent", listener);
        resolve(message as Extract<LocalBackendEvent, { type: T }>);
      };
      this.on("sent", listener);
    });
  }
}

const start = { type: "start", dataDir: "/data", sessionToken: "token", port: 0 };

describe("startLocalBackendHost", () => {
  const ports: FakeParentPort[] = [];

  afterEach(async () => {
    for (const port of ports.splice(0)) {
      port.command({ type: "stop" });
      await port.next("stopped");
    }
  });

  function host(createRuntime: CreateLocalBackendRuntime) {
    const port = new FakeParentPort();
    startLocalBackendHost(port, createRuntime, {
      pdfTimeoutMs: 1_000,
      aiSelectionTimeoutMs: 1_000,
    });
    return port;
  }

  it("serves the runtime on a loopback port and reports it", async () => {
    const createRuntime = vi.fn<CreateLocalBackendRuntime>(async () => ({
      app: (_request, response) => response.end("ok"),
      close: async () => undefined,
    }));
    const port = host(createRuntime);
    ports.push(port);

    port.command(start);
    const ready = await port.next("ready");

    expect(createRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ dataDir: "/data", sessionToken: "token" }),
    );
    await expect((await fetch(`http://127.0.0.1:${ready.port}/`)).text()).resolves.toBe("ok");
  });

  it("reports a start failure instead of crashing", async () => {
    const port = host(async () => {
      throw new Error("database is locked");
    });

    port.command(start);

    await expect(port.next("start:error")).resolves.toEqual({
      type: "start:error",
      message: "database is locked",
    });
  });

  it("bridges PDF rendering and AI selection requests to the main process", async () => {
    let options!: Parameters<CreateLocalBackendRuntime>[0];
    const port = host(async (received) => {
      options = received;
      return { app: (_request, response) => response.end(), close: async () => undefined };
    });
    ports.push(port);
    port.command(start);
    await port.next("ready");

    const pdf = options.pdfRenderer.htmlToPdf("<p>CV</p>");
    const pdfRequest = await port.next("pdf:request");
    port.command({
      type: "pdf:result",
      requestId: pdfRequest.requestId,
      pdf: new Uint8Array([37]),
    });
    const selection = options.aiProviderSelection.current();
    const selectionRequest = await port.next("ai-selection:request");
    port.command({
      type: "ai-selection:result",
      requestId: selectionRequest.requestId,
      selection: { provider: "anthropic", apiKey: "key" },
    });

    expect(pdfRequest.html).toBe("<p>CV</p>");
    await expect(pdf).resolves.toEqual(Buffer.from([37]));
    await expect(selection).resolves.toEqual({ provider: "anthropic", apiKey: "key" });
  });

  it("rejects a PDF request the main process reports as failed", async () => {
    let options!: Parameters<CreateLocalBackendRuntime>[0];
    const port = host(async (received) => {
      options = received;
      return { app: (_request, response) => response.end(), close: async () => undefined };
    });
    ports.push(port);
    port.command(start);
    await port.next("ready");

    const pdf = options.pdfRenderer.htmlToPdf("<p>CV</p>");
    const request = await port.next("pdf:request");
    port.command({ type: "pdf:error", requestId: request.requestId, message: "print failed" });

    await expect(pdf).rejects.toThrow("print failed");
  });

  it("closes open connections and the runtime on stop", async () => {
    const close = vi.fn(async () => undefined);
    const port = host(async () => ({
      // Never ends the response, like a server-sent event stream.
      app: (_request, response) => response.write("data: open\n\n"),
      close,
    }));
    port.command(start);
    const ready = await port.next("ready");
    const stream = await fetch(`http://127.0.0.1:${ready.port}/stream`);

    port.command({ type: "stop" });
    await port.next("stopped");

    expect(stream.status).toBe(200);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("startLocalBackendHost backups", () => {
  let root: string;
  let dataDir: string;
  const ports: FakeParentPort[] = [];
  const manifest: LocalBackendBackupManifest = {
    createdAt: "2026-11-01T09:30:00.000Z",
    appVersion: "0.6.0",
    tables: [
      { name: "job_applications", rows: 4 },
      { name: "user_profiles", rows: 1 },
    ],
    files: 2,
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-host-"));
    dataDir = join(root, "data");
    await mkdir(dataDir);
    await writeFile(join(dataDir, "marker.txt"), "current");
  });

  afterEach(async () => {
    for (const port of ports.splice(0)) {
      port.command({ type: "stop" });
      await port.next("stopped");
    }
    await rm(root, { recursive: true, force: true });
  });

  // Each runtime answers HTTP requests with the marker of the data directory it opened.
  function runtimeFactory(options: { failWhenMarkerIs?: string } = {}) {
    const runtimes: Array<LocalBackendRuntime & { marker: string }> = [];
    const createRuntime = vi.fn<CreateLocalBackendRuntime>(async (received) => {
      const marker = await readFile(join(received.dataDir, "marker.txt"), "utf8");
      if (marker === options.failWhenMarkerIs) throw new Error("database is corrupt");
      const runtime = {
        marker,
        app: ((_request, response) => response.end(marker)) as LocalBackendRuntime["app"],
        exportBackup: vi.fn(async ({ outputPath }: { outputPath: string }) => {
          await writeFile(outputPath, `snapshot of ${marker}`);
          return manifest;
        }),
        close: vi.fn(async () => undefined),
      };
      runtimes.push(runtime);
      return runtime;
    });
    return { createRuntime, runtimes };
  }

  async function host(
    createRuntime: CreateLocalBackendRuntime,
    prepareImport?: PrepareLocalBackupImport,
  ) {
    const port = new FakeParentPort();
    startLocalBackendHost(port, createRuntime, prepareImport ? { prepareImport } : {});
    ports.push(port);
    port.command({ type: "start", dataDir, sessionToken: "token", port: 0 });
    const ready = await port.next("ready");
    return { port, get: async () => (await fetch(`http://127.0.0.1:${ready.port}/`)).text() };
  }

  const stagedImport: PrepareLocalBackupImport = async ({ stagingDir }) => {
    await mkdir(stagingDir, { recursive: true });
    await writeFile(join(stagingDir, "marker.txt"), "imported");
    return manifest;
  };

  const importCommand = () => ({
    type: "backup:import",
    requestId: "import-1",
    archivePath: join(root, "backup.zip"),
    snapshotPath: join(root, "backups", "before-import.zip"),
    appVersion: "0.7.0",
  });

  it("exports through the running runtime and reports a summary", async () => {
    const { createRuntime, runtimes } = runtimeFactory();
    const { port } = await host(createRuntime);
    const outputPath = join(root, "exports", "backup.zip");

    port.command({ type: "backup:export", requestId: "export-1", outputPath, appVersion: "0.7.0" });

    await expect(port.next("backup:result")).resolves.toEqual({
      type: "backup:result",
      requestId: "export-1",
      summary: { createdAt: manifest.createdAt, appVersion: "0.6.0", applications: 4, files: 2 },
    });
    expect(runtimes[0]?.exportBackup).toHaveBeenCalledWith({ outputPath, appVersion: "0.7.0" });
    await expect(readFile(outputPath, "utf8")).resolves.toBe("snapshot of current");
  });

  it("snapshots the current data, swaps in the import, and keeps serving on the same port", async () => {
    const { createRuntime, runtimes } = runtimeFactory();
    const prepareImport = vi.fn(stagedImport);
    const { port, get } = await host(createRuntime, prepareImport);
    await expect(get()).resolves.toBe("current");

    port.command(importCommand());

    await expect(port.next("backup:result")).resolves.toMatchObject({
      requestId: "import-1",
      summary: { applications: 4 },
    });
    expect(prepareImport).toHaveBeenCalledWith({
      archivePath: join(root, "backup.zip"),
      stagingDir: `${dataDir}.import`,
    });
    await expect(readFile(join(root, "backups", "before-import.zip"), "utf8")).resolves.toBe(
      "snapshot of current",
    );
    expect(runtimes[0]?.close).toHaveBeenCalledOnce();
    await expect(readFile(join(dataDir, "marker.txt"), "utf8")).resolves.toBe("imported");
    expect((await readdir(root)).sort()).toEqual(["backups", "data"]);
    await expect(get()).resolves.toBe("imported");
  });

  it("leaves the current data in use when the archive is rejected", async () => {
    const { createRuntime, runtimes } = runtimeFactory();
    const { port, get } = await host(createRuntime, async () => {
      throw Object.assign(new Error("This backup is damaged and cannot be imported."), {
        name: "LocalBackupError",
      });
    });

    port.command(importCommand());

    await expect(port.next("backup:error")).resolves.toEqual({
      type: "backup:error",
      requestId: "import-1",
      message: "This backup is damaged and cannot be imported.",
    });
    expect(runtimes[0]?.exportBackup).not.toHaveBeenCalled();
    expect(runtimes[0]?.close).not.toHaveBeenCalled();
    await expect(get()).resolves.toBe("current");
  });

  it("moves the previous data back when the imported data cannot be opened", async () => {
    const { createRuntime } = runtimeFactory({ failWhenMarkerIs: "imported" });
    const { port, get } = await host(createRuntime, stagedImport);

    port.command(importCommand());

    await expect(port.next("backup:error")).resolves.toMatchObject({
      message: "The imported data could not be opened. Your previous data was restored.",
    });
    await expect(readFile(join(dataDir, "marker.txt"), "utf8")).resolves.toBe("current");
    expect((await readdir(root)).sort()).toEqual(["backups", "data"]);
    await expect(get()).resolves.toBe("current");
  });

  it("reports unexpected failures with a generic message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { createRuntime } = runtimeFactory();
    const { port } = await host(createRuntime, async () => {
      throw new Error("EACCES: permission denied, open '/secret/path'");
    });

    port.command(importCommand());

    await expect(port.next("backup:error")).resolves.toMatchObject({
      message: "The backup could not be imported.",
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

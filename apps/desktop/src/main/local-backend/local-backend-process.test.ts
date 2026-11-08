import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { LocalBackendCommand } from "./local-backend-messages.js";
import { LocalBackendProcess, type LocalBackendProcessOptions } from "./local-backend-process.js";
import { LocalBackendStartError } from "../startup-recovery/startup-failure.js";

class FakeChild extends EventEmitter {
  readonly commands: LocalBackendCommand[] = [];
  readonly kill = vi.fn(() => {
    this.emit("exit", 0);
    return true;
  });

  postMessage(command: LocalBackendCommand): void {
    this.commands.push(command);
  }

  reply(message: unknown): void {
    this.emit("message", message);
  }
}

function createProcess(overrides: Partial<LocalBackendProcessOptions> = {}) {
  const child = new FakeChild();
  const backend = new LocalBackendProcess({
    modulePath: "/dist/main/local-backend/local-backend-utility-process.js",
    dataDir: "/user-data/data",
    sessionToken: "token",
    appVersion: "1.2.3",
    backupsDir: "/user-data/backups",
    logFile: "/user-data/logs/local-backend.log",
    renderPdf: vi.fn(async () => Buffer.from("%PDF")),
    getAiSelection: vi.fn(async () => null),
    fork: vi.fn(() => child as never),
    startTimeoutMs: 1_000,
    stopTimeoutMs: 1_000,
    ...overrides,
  });
  return { backend, child };
}

describe("LocalBackendProcess", () => {
  it("starts the utility process and resolves its loopback base URL", async () => {
    const { backend, child } = createProcess({ port: 3010 });

    const started = backend.start();
    child.reply({ type: "ready", port: 3010, lastMigration: "20261031000000_x.cjs" });

    await expect(started).resolves.toEqual({
      baseUrl: "http://127.0.0.1:3010",
      lastMigration: "20261031000000_x.cjs",
    });
    expect(child.commands[0]).toEqual({
      type: "start",
      dataDir: "/user-data/data",
      sessionToken: "token",
      port: 3010,
      appVersion: "1.2.3",
      backupsDir: "/user-data/backups",
      logFile: "/user-data/logs/local-backend.log",
    });
  });

  it("fails start when the backend reports an error or exits early", async () => {
    const failing = createProcess();
    const failed = failing.backend.start();
    failing.child.reply({ type: "start:error", message: "database is locked" });
    await expect(failed).rejects.toThrow("The local backend failed to start: database is locked");
    expect(failing.child.kill).toHaveBeenCalled();

    const exiting = createProcess();
    const exited = exiting.backend.start();
    exiting.child.emit("exit", 1);
    await expect(exited).rejects.toThrow("The local backend exited before it was ready (code 1)");
  });

  it("rejects with the data failure the backend reports, never as an unexpected exit", async () => {
    const onUnexpectedExit = vi.fn();
    const { backend, child } = createProcess({ onUnexpectedExit });
    const failure = {
      reason: "newer-version" as const,
      message: "This data was created by a newer version of Careerden.",
      unknownMigrations: ["29990101000000_future.cjs"],
    };

    const started = backend.start();
    child.reply({ type: "start:data-error", failure });

    const error = await started.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LocalBackendStartError);
    expect((error as LocalBackendStartError).failure).toEqual(failure);
    expect(child.kill).toHaveBeenCalled();
    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it("does not report a crash during start as an unexpected exit", async () => {
    // Reporting it restarted the app, which crashed again on the next launch, forever.
    const onUnexpectedExit = vi.fn();
    const { backend, child } = createProcess({ onUnexpectedExit });

    const started = backend.start();
    child.emit("exit", 134);

    const error = await started.catch((caught: unknown) => caught);
    expect((error as LocalBackendStartError).failure).toEqual({
      reason: "start-failed",
      message: "The local backend exited before it was ready (code 134)",
    });
    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it("answers PDF and AI selection requests from the backend", async () => {
    const renderPdf = vi.fn(async () => Buffer.from("%PDF"));
    const getAiSelection = vi.fn(async () => ({ provider: "openai" as const, apiKey: "key" }));
    const { backend, child } = createProcess({ renderPdf, getAiSelection });
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;

    child.reply({ type: "pdf:request", requestId: "pdf-1", html: "<p>CV</p>" });
    child.reply({ type: "ai-selection:request", requestId: "ai-1" });

    await vi.waitFor(() => expect(child.commands).toHaveLength(3));
    expect(renderPdf).toHaveBeenCalledWith("<p>CV</p>");
    expect(child.commands).toContainEqual({
      type: "pdf:result",
      requestId: "pdf-1",
      pdf: Buffer.from("%PDF"),
    });
    expect(child.commands).toContainEqual({
      type: "ai-selection:result",
      requestId: "ai-1",
      selection: { provider: "openai", apiKey: "key" },
    });
  });

  it("reports PDF rendering failures back to the backend", async () => {
    const { backend, child } = createProcess({
      renderPdf: vi.fn(async () => {
        throw new Error("print failed");
      }),
    });
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;

    child.reply({ type: "pdf:request", requestId: "pdf-1", html: "<p>CV</p>" });

    await vi.waitFor(() =>
      expect(child.commands).toContainEqual({
        type: "pdf:error",
        requestId: "pdf-1",
        message: "print failed",
      }),
    );
  });

  async function started(overrides: Partial<LocalBackendProcessOptions> = {}) {
    const created = createProcess(overrides);
    const starting = created.backend.start();
    created.child.reply({ type: "ready", port: 1 });
    await starting;
    return created;
  }

  it("shuts down cleanly when the backend exits on its own after closing its data", async () => {
    const onUnexpectedExit = vi.fn();
    const { backend, child } = await started({ onUnexpectedExit });

    const stopped = backend.stop();
    expect(child.commands.at(-1)).toEqual({ type: "shutdown" });
    child.reply({ type: "shutdown:complete" });
    child.emit("exit", 0);
    await stopped;

    expect(child.kill).not.toHaveBeenCalled();
    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it("sends one shutdown when quit is requested again while shutting down", async () => {
    const { backend, child } = await started();

    const first = backend.stop();
    const second = backend.stop();
    child.reply({ type: "shutdown:complete" });
    child.emit("exit", 0);
    await Promise.all([first, second]);

    expect(child.commands.filter((command) => command.type === "shutdown")).toHaveLength(1);
  });

  it("kills a backend that reports a completed shutdown but does not exit", async () => {
    const { backend, child } = await started({ exitTimeoutMs: 10 });

    const stopped = backend.stop();
    child.reply({ type: "shutdown:complete" });
    await stopped;

    expect(child.kill).toHaveBeenCalledOnce();
  });

  it("kills a backend that does not shut down in time", async () => {
    const onUnexpectedExit = vi.fn();
    const { backend, child } = await started({ onUnexpectedExit, stopTimeoutMs: 10 });

    await backend.stop();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it("does not report an exit during shutdown as unexpected, whatever its code", async () => {
    // PGlite exits with code 99 when the process ends with its client still open.
    const onUnexpectedExit = vi.fn();
    const { backend, child } = await started({ onUnexpectedExit });

    const stopped = backend.stop();
    child.emit("exit", 99);
    await stopped;

    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it("reports an exit after a successful start as unexpected", async () => {
    const onUnexpectedExit = vi.fn();
    const { child } = await started({ onUnexpectedExit });

    child.emit("exit", 9);

    expect(onUnexpectedExit).toHaveBeenCalledWith(9);
  });

  it("sends backup commands and settles them from the backend's reply", async () => {
    const { backend, child } = createProcess();
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;
    const summary = {
      createdAt: "2026-11-01T00:00:00.000Z",
      appVersion: "0.7.0",
      applications: 2,
      files: 1,
    };

    const exported = backend.exportBackup("/backups/out.zip", "0.7.0");
    const exportCommand = child.commands.at(-1) as Extract<
      LocalBackendCommand,
      { type: "backup:export" }
    >;
    expect(exportCommand).toMatchObject({
      type: "backup:export",
      outputPath: "/backups/out.zip",
      appVersion: "0.7.0",
    });
    child.reply({ type: "backup:result", requestId: exportCommand.requestId, summary });
    await expect(exported).resolves.toEqual(summary);

    const imported = backend.importBackup("/in.zip", "/backups/before.zip", "0.7.0");
    const importCommand = child.commands.at(-1) as Extract<
      LocalBackendCommand,
      { type: "backup:import" }
    >;
    expect(importCommand).toMatchObject({
      type: "backup:import",
      archivePath: "/in.zip",
      snapshotPath: "/backups/before.zip",
    });
    child.reply({ type: "backup:error", requestId: importCommand.requestId, message: "damaged" });
    await expect(imported).rejects.toThrow("damaged");
  });

  it("rejects a pending backup when the backend exits", async () => {
    const { backend, child } = createProcess({ onUnexpectedExit: vi.fn() });
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;

    const exported = backend.exportBackup("/backups/out.zip", "0.7.0");
    child.emit("exit", 1);

    await expect(exported).rejects.toThrow("stopped before the backup finished");
    await expect(backend.exportBackup("/backups/out.zip", "0.7.0")).rejects.toThrow("not running");
  });
});

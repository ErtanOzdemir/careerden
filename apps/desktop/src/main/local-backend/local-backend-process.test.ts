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

  it("stops gracefully and only reports unexpected exits", async () => {
    const onUnexpectedExit = vi.fn();
    const { backend, child } = createProcess({ onUnexpectedExit });
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;

    const stopped = backend.stop();
    expect(child.commands.at(-1)).toEqual({ type: "stop" });
    child.reply({ type: "stopped" });
    await stopped;

    expect(child.kill).toHaveBeenCalled();
    expect(onUnexpectedExit).not.toHaveBeenCalled();

    const crashing = createProcess({ onUnexpectedExit });
    const crashingStart = crashing.backend.start();
    crashing.child.reply({ type: "ready", port: 1 });
    await crashingStart;
    crashing.child.emit("exit", 9);
    expect(onUnexpectedExit).toHaveBeenCalledWith(9);
  });

  it("logs its lifecycle and forwards the backend's own log entries", async () => {
    const log = vi.fn();
    const childLog = vi.fn();
    const { backend, child } = createProcess({ log, childLog, onUnexpectedExit: vi.fn() });
    const started = backend.start();
    child.reply({ type: "ready", port: 1 });
    await started;

    child.reply({
      type: "log",
      entry: {
        level: "info",
        event: "migration.finished",
        fields: { applied: 2, nested: { profile: "Ada" } },
      },
    });
    child.reply({ type: "log", entry: { level: "loud", event: "ignored" } });
    child.emit("exit", 3);

    expect(childLog).toHaveBeenCalledTimes(1);
    expect(childLog).toHaveBeenCalledWith({
      level: "info",
      event: "migration.finished",
      fields: { applied: 2 },
    });
    expect(log.mock.calls.map(([entry]) => entry.event)).toEqual([
      "local_backend.starting",
      "local_backend.ready",
      "local_backend.unexpected_exit",
    ]);
    expect(log).toHaveBeenLastCalledWith({
      level: "error",
      event: "local_backend.unexpected_exit",
      fields: { exitCode: 3 },
    });
  });
});

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { LocalBackendCommand } from "./local-backend-messages.js";
import { LocalBackendProcess, type LocalBackendProcessOptions } from "./local-backend-process.js";

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
    child.reply({ type: "ready", port: 3010 });

    await expect(started).resolves.toEqual({ baseUrl: "http://127.0.0.1:3010" });
    expect(child.commands[0]).toEqual({
      type: "start",
      dataDir: "/user-data/data",
      sessionToken: "token",
      port: 3010,
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
    await expect(exited).rejects.toThrow("The local backend exited before it was ready");
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
});

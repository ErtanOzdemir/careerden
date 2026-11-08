import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalBackendEvent, LocalDataStartupFailure } from "./local-backend-messages.js";
import type { CreateLocalBackendRuntime, LocalBackendParentPort } from "./local-backend-host.js";
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

const start = {
  type: "start",
  dataDir: "/data",
  sessionToken: "token",
  port: 0,
  appVersion: "1.2.3",
  backupsDir: "/backups",
  logFile: "/logs/local-backend.log",
};

describe("startLocalBackendHost", () => {
  const ports: FakeParentPort[] = [];

  afterEach(async () => {
    for (const port of ports.splice(0)) {
      port.command({ type: "stop" });
      await port.next("stopped");
    }
  });

  function host(
    createRuntime: CreateLocalBackendRuntime,
    describeStartupError?: (error: unknown) => LocalDataStartupFailure | undefined,
  ) {
    const port = new FakeParentPort();
    startLocalBackendHost(port, createRuntime, {
      pdfTimeoutMs: 1_000,
      aiSelectionTimeoutMs: 1_000,
      ...(describeStartupError ? { describeStartupError } : {}),
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
      expect.objectContaining({
        dataDir: "/data",
        sessionToken: "token",
        dataSnapshots: expect.objectContaining({ appVersion: "1.2.3", backupsDir: "/backups" }),
      }),
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

  it("reports the database's newest migration once ready", async () => {
    const port = host(async () => ({
      app: (_request, response) => response.end(),
      lastMigration: "20261031000000_profile_onboarding_state.cjs",
      close: async () => undefined,
    }));
    ports.push(port);

    port.command(start);

    await expect(port.next("ready")).resolves.toMatchObject({
      lastMigration: "20261031000000_profile_onboarding_state.cjs",
    });
  });

  it("reports local data that cannot be opened as a distinct data error", async () => {
    const failure: LocalDataStartupFailure = {
      reason: "migration",
      message: "A database update failed: column already exists",
      lastMigration: "20261012000000_auth_rate_limits.cjs",
    };
    class DataError extends Error {}
    const port = host(
      async () => {
        throw new DataError(failure.message);
      },
      (error) => (error instanceof DataError ? failure : undefined),
    );

    port.command(start);

    await expect(port.next("start:data-error")).resolves.toEqual({
      type: "start:data-error",
      failure,
    });
    expect(port.sent.some((event) => event.type === "start:error")).toBe(false);
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

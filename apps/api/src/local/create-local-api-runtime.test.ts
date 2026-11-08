import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import type { AiProvider } from "@careerden/domain";
import type { AiProviderSelection } from "@careerden/infrastructure";
import type { LocalApiRuntime } from "./create-local-api-runtime.js";
import { createLocalApiRuntime } from "./create-local-api-runtime.js";
import { prepareLocalDataImport } from "../infrastructure/backup/local-data-backup.js";
import { localSessionTokenHeader } from "./local-session.middleware.js";

const sessionToken = "test-session-token";

// Boots the whole local runtime on embedded PGlite and drives it over HTTP like the desktop shell.
describe("createLocalApiRuntime", { timeout: 60_000 }, () => {
  let dataDir: string;
  let selection: AiProviderSelection | null;
  const runtimes: LocalApiRuntime[] = [];
  const servers: Server[] = [];

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "careerden-local-"));
    selection = null;
  });

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
    await rm(dataDir, { recursive: true, force: true });
  });

  async function start(aiProvider?: AiProvider, device = "Careerden Unplugged") {
    const runtime = await createLocalApiRuntime({
      // A fresh install has no data directory yet.
      dataDir: join(dataDir, device, "data"),
      sessionToken,
      pdfRenderer: { htmlToPdf: async () => Buffer.from("%PDF-test") },
      aiProviderSelection: { current: async () => selection },
      ...(aiProvider ? { createAiProvider: () => aiProvider } : {}),
      backgroundPollIntervalMs: 50,
    });
    runtimes.push(runtime);
    const server = runtime.app.listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    return {
      runtime,
      request: (path: string, init: RequestInit = {}) =>
        fetch(`${baseUrl}${path}`, {
          ...init,
          headers: {
            [localSessionTokenHeader]: sessionToken,
            "content-type": "application/json",
            ...init.headers,
          },
        }),
      anonymous: (path: string) => fetch(`${baseUrl}${path}`),
    };
  }

  async function stop(runtime: LocalApiRuntime) {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    runtimes.splice(runtimes.indexOf(runtime), 1);
    await runtime.close();
  }

  it("logs migration progress through the injected logger", async () => {
    const logger = vi.fn();
    const runtime = await createLocalApiRuntime({
      dataDir: join(dataDir, "data"),
      sessionToken,
      pdfRenderer: { htmlToPdf: async () => Buffer.from("%PDF-test") },
      aiProviderSelection: { current: async () => null },
      logger,
    });
    runtimes.push(runtime);

    const events = logger.mock.calls.map(([entry]) => entry);
    expect(events[0]).toMatchObject({ level: "info", event: "migration.started" });
    expect(events[1]).toMatchObject({
      level: "info",
      event: "migration.finished",
      fields: { applied: expect.any(Number), durationMs: expect.any(Number) },
    });
    expect((events[1] as { fields: { applied: number } }).fields.applied).toBeGreaterThan(0);
  });

  it("requires the per-launch session token on application routes", async () => {
    const { anonymous, request } = await start();

    expect((await anonymous("/health")).status).toBe(200);
    expect((await anonymous("/profiles/me")).status).toBe(401);
    expect(
      (await request("/profiles/me", { headers: { [localSessionTokenHeader]: "wrong-token" } }))
        .status,
    ).toBe(401);
    expect((await request("/profiles/me")).status).toBe(200);
  });

  it("serves no account, billing, or support routes", async () => {
    const { request } = await start();

    const responses = await Promise.all([
      request("/auth/get-session"),
      request("/billing/credits"),
      request("/support", { method: "POST", body: "{}" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
  });

  it("keeps the local profile across restarts", async () => {
    const first = await start();
    const created = (await (await first.request("/profiles/me")).json()) as {
      id: string;
      fullName: string;
      email: string;
    };
    expect(created).toMatchObject({ fullName: "", email: "" });
    await first.request("/profiles/me", {
      method: "PATCH",
      body: JSON.stringify({ fullName: "Ada Lovelace" }),
    });
    await stop(first.runtime);

    const second = await start();
    const reopened = (await (await second.request("/profiles/me")).json()) as {
      id: string;
      fullName: string;
    };

    expect(reopened).toMatchObject({ id: created.id, fullName: "Ada Lovelace" });
  });

  async function createManualJob(request: Awaited<ReturnType<typeof start>>["request"]) {
    const profile = (await (
      await request("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify({
          headline: "Backend engineer",
          skills: ["TypeScript"],
          experience: [{ company: "Analytical Engines", title: "Engineer" }],
        }),
      })
    ).json()) as { id: string };

    return request("/job-applications/manual", {
      method: "POST",
      body: JSON.stringify({
        profileId: profile.id,
        companyName: "Acme",
        roleTitle: "Engineer",
        jobDescription: "Build reliable TypeScript services.",
      }),
    });
  }

  it("saves a manual job without queueing AI analysis until a provider is configured", async () => {
    const { request } = await start();

    const created = await createManualJob(request);
    const application = (await created.json()) as { id: string };
    const events = (await (
      await request(`/job-applications/${application.id}/events`)
    ).json()) as Array<{ title: string; metadata?: Record<string, unknown> }>;
    const analysis = await request(`/job-applications/${application.id}/analysis`, {
      method: "POST",
    });

    expect(created.status).toBe(201);
    expect(events).toContainEqual(
      expect.objectContaining({
        title: "AI analysis skipped",
        metadata: { reason: "ai_provider_not_configured" },
      }),
    );
    expect(analysis.status).toBe(409);
    await expect(analysis.json()).resolves.toMatchObject({ code: "ai_provider_not_configured" });
  });

  it("runs queued AI analysis in process and records a terminal failure", async () => {
    selection = { provider: "anthropic", apiKey: "user-key" };
    const { request } = await start({
      generate: async () => {
        throw new ApplicationError("validation", "The model refused this job description.");
      },
    });

    const application = (await (await createManualJob(request)).json()) as { id: string };

    await expect
      .poll(
        async () =>
          (
            (await (await request(`/job-applications/${application.id}`)).json()) as {
              status: string;
            }
          ).status,
        { timeout: 10_000, interval: 100 },
      )
      .toBe("failed");
  });

  it("exports a backup that a clean install on another device restores intact", async () => {
    const first = await start(undefined, "device-a");
    const application = (await (await createManualJob(first.request)).json()) as { id: string };
    const archivePath = join(dataDir, "backup.zip");
    await first.runtime.exportBackup({ outputPath: archivePath, appVersion: "0.7.0" });
    await stop(first.runtime);

    // The desktop host swaps a staged import into place before the runtime starts on it.
    await prepareLocalDataImport({ archivePath, stagingDir: join(dataDir, "device-b", "data") });
    const second = await start(undefined, "device-b");

    const restored = (await (
      await second.request(`/job-applications/${application.id}`)
    ).json()) as { id: string; tracking: { companyName: string } };
    const profile = (await (await second.request("/profiles/me")).json()) as {
      headline: string;
    };
    expect(restored).toMatchObject({ id: application.id, tracking: { companyName: "Acme" } });
    expect(profile.headline).toBe("Backend engineer");
  });
});

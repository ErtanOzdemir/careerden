import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import { AiProviderError } from "@careerden/domain";
import type { AiProvider } from "@careerden/domain";
import type { AiProviderSelection } from "@careerden/infrastructure";
import { aiModelCandidates, ModelFallbackAiProvider } from "@careerden/infrastructure";
import type { LocalApiRuntime, LocalApiRuntimeOptions } from "./create-local-api-runtime.js";
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

  function start(
    aiProvider?: AiProvider,
    device = "Careerden Unplugged",
    overrides: Partial<LocalApiRuntimeOptions> = {},
  ) {
    return startWithModelProvider(aiProvider ? () => aiProvider : undefined, device, overrides);
  }

  async function startWithModelProvider(
    createAiProvider?: (selection: AiProviderSelection) => AiProvider,
    device = "Careerden Unplugged",
    overrides: Partial<LocalApiRuntimeOptions> = {},
  ) {
    const runtime = await createLocalApiRuntime({
      // A fresh install has no data directory yet.
      dataDir: join(dataDir, device, "data"),
      sessionToken,
      pdfRenderer: { htmlToPdf: async () => Buffer.from("%PDF-test") },
      aiProviderSelection: { current: async () => selection },
      ...(createAiProvider ? { createAiProvider } : {}),
      backgroundPollIntervalMs: 50,
      ...overrides,
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

  it("describes the embedded database engine and its newest migration", async () => {
    const { runtime } = await start();

    const diagnostics = await runtime.describeDatabase();

    expect(diagnostics.engineVersion).toMatch(/^PGlite \(PostgreSQL \d+(\.\d+)*\)$/);
    expect(diagnostics.lastMigration).toBe(runtime.lastMigration);
    expect(diagnostics.lastMigration).toMatch(/^\d{14}_[a-z0-9_]+\.cjs$/);
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

  it("completes analysis on the fallback model when the configured model is retired", async () => {
    selection = {
      provider: "openai",
      apiKey: "user-key",
      models: { recommended: "gpt-retired", fallbacks: ["gpt-live"] },
    };
    const modelsUsed: string[] = [];
    const runtime = await startWithModelProvider((selected) =>
      createAiProviderWithModels(selected, (model) => ({
        generate: async (params) => {
          modelsUsed.push(model);
          if (model === "gpt-retired") {
            throw new APICallError({
              message: "The model `gpt-retired` has been deprecated",
              url: "https://api.openai.com/v1/chat/completions",
              requestBodyValues: {},
              statusCode: 404,
            });
          }
          return params.outputSchema.parse(analysisResponse());
        },
      })),
    );

    const application = (await (await createManualJob(runtime.request)).json()) as { id: string };

    await expect
      .poll(
        async () =>
          (
            (await (await runtime.request(`/job-applications/${application.id}`)).json()) as {
              status: string;
            }
          ).status,
        { timeout: 10_000, interval: 100 },
      )
      .toBe("completed");
    const detail = (await (
      await runtime.request(`/job-applications/${application.id}`)
    ).json()) as { matchAnalysis?: { generatedBy?: unknown } };
    const events = (await (
      await runtime.request(`/job-applications/${application.id}/events`)
    ).json()) as Array<{ title: string; metadata?: Record<string, unknown> }>;

    expect(modelsUsed).toContain("gpt-live");
    expect(detail.matchAnalysis?.generatedBy).toEqual({ provider: "openai", model: "gpt-live" });
    expect(events).toContainEqual(
      expect.objectContaining({
        title: "AI analysis completed",
        metadata: expect.objectContaining({ aiProvider: "openai", aiModel: "gpt-live" }),
      }),
    );
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

  it("fails analysis on a rejected key at once and records why for the UI", async () => {
    selection = { provider: "openai", apiKey: "revoked-key" };
    let calls = 0;
    const { request } = await start({
      generate: async () => {
        calls += 1;
        throw new AiProviderError({
          category: "invalid_api_key",
          provider: "openai",
          statusCode: 401,
        });
      },
    });

    const application = (await (await createManualJob(request)).json()) as { id: string };

    await expect
      .poll(
        async () =>
          (await (await request(`/job-applications/${application.id}`)).json()) as {
            status: string;
            failureReason?: string;
            aiFailure?: unknown;
          },
        { timeout: 10_000, interval: 100 },
      )
      .toMatchObject({
        status: "failed",
        failureReason: "Your API key is invalid or revoked. Update it in Settings.",
        aiFailure: { category: "invalid_api_key", provider: "openai", statusCode: 401 },
      });
    // Not retried: a bad key fails the same way every time.
    expect(calls).toBe(1);
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

  it("closes the database after a bounded wait for background work in flight", async () => {
    selection = { provider: "anthropic", apiKey: "user-key" };
    let analysisStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      analysisStarted = resolve;
    });
    const first = await start(
      {
        // Never answers, like a slow AI request when the app quits.
        generate: () => {
          analysisStarted();
          return new Promise(() => undefined);
        },
      },
      undefined,
      { shutdownGraceMs: 100 },
    );
    const application = (await (await createManualJob(first.request)).json()) as { id: string };
    await started;

    await stop(first.runtime);

    await expect(first.runtime.db.raw("select 1")).rejects.toThrow();
    // The data opens again. No provider this time, so the reclaimed analysis fails fast.
    selection = null;
    const second = await start();
    const reopened = (await (
      await second.request(`/job-applications/${application.id}`)
    ).json()) as { id: string };
    expect(reopened.id).toBe(application.id);
  });
});

// The real model fallback over fake single-model providers, so no request leaves the test.
function createAiProviderWithModels(
  selection: AiProviderSelection,
  forModel: (model: string) => AiProvider,
): AiProvider {
  return new ModelFallbackAiProvider(selection.provider, aiModelCandidates(selection), forModel);
}

// Satisfies both the requirement extraction and the match analysis output schemas.
function analysisResponse(): Record<string, unknown> {
  return {
    requirements: ["Build reliable TypeScript services"],
    matchScore: 80,
    requirementEvaluations: [
      {
        requirement: "Build reliable TypeScript services",
        status: "matched",
        evidence: ["TypeScript"],
      },
    ],
    missingSkills: [],
    strongSkills: ["TypeScript"],
    summaryTips: [],
    coverLetterContent: "I am applying for the Engineer role at Acme.",
    interviewTips: ["Prepare TypeScript examples."],
    experienceTips: [{ experienceIndex: 0, tips: [] }],
  };
}

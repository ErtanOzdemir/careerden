import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "../middleware/error-handler.js";
import { createProfileRouter } from "./profiles.routes.js";

type RouterDependencies = Parameters<typeof createProfileRouter>[0];

describe("profile CV import routes", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  async function listen(overrides: Partial<RouterDependencies>): Promise<string> {
    const dependencies = {
      getCurrentProfile: { execute: vi.fn(async () => ({ id: "profile-1" })) },
      applyProfileImport: { execute: vi.fn(async () => ({ id: "profile-1" })) },
      ...overrides,
    } as unknown as RouterDependencies;
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
      (request as unknown as { user: unknown }).user = { id: "user-1", email: "", name: "" };
      next();
    });
    app.use("/profiles", createProfileRouter(dependencies));
    app.use(createErrorHandler(() => undefined));

    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("extracts a draft from an uploaded CV", async () => {
    const execute = vi.fn(async () => ({ fullName: "Ada Lovelace" }));
    const baseUrl = await listen({
      extractProfileFromCv: { execute } as unknown as RouterDependencies["extractProfileFromCv"],
    });
    const body = new FormData();
    body.set("cv", new Blob(["%PDF-1.7 ..."], { type: "application/pdf" }), "cv.pdf");

    const response = await fetch(`${baseUrl}/profiles/me/cv-import`, { method: "POST", body });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ draft: { fullName: "Ada Lovelace" } });
    expect(execute).toHaveBeenCalledWith("profile-1", "user-1", {
      kind: "pdf",
      body: Buffer.from("%PDF-1.7 ..."),
    });
  });

  it("rejects unsupported files and leaves extraction unmounted without an AI provider", async () => {
    const withAi = await listen({
      extractProfileFromCv: {
        execute: vi.fn(),
      } as unknown as RouterDependencies["extractProfileFromCv"],
    });
    const body = new FormData();
    body.set("cv", new Blob(["GIF89a"], { type: "image/gif" }), "cv.gif");
    const unsupported = await fetch(`${withAi}/profiles/me/cv-import`, { method: "POST", body });

    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({ code: "validation" });

    const withoutAi = await listen({});
    const missing = await fetch(`${withoutAi}/profiles/me/cv-import`, { method: "POST" });
    expect(missing.status).toBe(404);
  });

  it("validates and applies a reviewed draft", async () => {
    const applyProfileImport = { execute: vi.fn(async () => ({ id: "profile-1" })) };
    const baseUrl = await listen({
      applyProfileImport: applyProfileImport as unknown as RouterDependencies["applyProfileImport"],
    });

    const invalid = await fetch(`${baseUrl}/profiles/me/cv-import/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links: ["not a url"] }),
    });
    const applied = await fetch(`${baseUrl}/profiles/me/cv-import/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ headline: "Analyst" }),
    });

    expect(invalid.status).toBe(400);
    expect(applied.status).toBe(200);
    expect(applyProfileImport.execute).toHaveBeenCalledOnce();
    expect(applyProfileImport.execute).toHaveBeenCalledWith("profile-1", "user-1", {
      headline: "Analyst",
    });
  });
});

import type { Express, RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiAppDependencies } from "./api-app.js";
import { createApiApp } from "./api-app.js";

describe("createApiApp", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  async function listen(app: Express): Promise<string> {
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("serves health checks without authentication", async () => {
    const authenticate = vi.fn<RequestHandler>((_request, response) => {
      response.status(401).end();
    });
    const baseUrl = await listen(createApiApp(createDependencies({ authenticate })));

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("authenticates every application route", async () => {
    const authenticate = vi.fn<RequestHandler>((_request, response) => {
      response.status(401).json({ code: "unauthorized" });
    });
    const baseUrl = await listen(createApiApp(createDependencies({ authenticate })));

    const response = await fetch(`${baseUrl}/profiles/current`);

    expect(response.status).toBe(401);
    expect(authenticate).toHaveBeenCalledOnce();
  });

  it("leaves billing and support unmounted when their dependencies are absent", async () => {
    const baseUrl = await listen(createApiApp(createDependencies()));

    const [billing, support] = await Promise.all([
      fetch(`${baseUrl}/billing/credits`),
      fetch(`${baseUrl}/support`, { method: "POST" }),
    ]);

    expect(billing.status).toBe(404);
    expect(support.status).toBe(404);
  });

  it("mounts raw routes before JSON body parsing", async () => {
    let rawBody: unknown;
    const baseUrl = await listen(
      createApiApp(
        createDependencies({
          mountRawRoutes: (app) => {
            app.post("/raw", (request, response) => {
              rawBody = request.body;
              response.status(204).end();
            });
          },
        }),
      ),
    );

    await fetch(`${baseUrl}/raw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signed: true }),
    });

    expect(rawBody).toBeUndefined();
  });
});

function createDependencies(http: Partial<ApiAppDependencies["http"]> = {}): ApiAppDependencies {
  return {
    jobApplications: {} as never,
    notifications: {} as never,
    profiles: {} as never,
    unitOfWork: {} as never,
    storage: {} as never,
    pdfRenderer: {} as never,
    remoteImageFetcher: {} as never,
    jobApplicationChanges: {} as never,
    notificationChanges: {} as never,
    http: {
      enableHsts: false,
      authenticate: (_request, _response, next) => next(),
      ...http,
    },
  };
}

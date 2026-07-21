import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitSupportRequestUseCase } from "@careerden/application";
import type { SupportRequestNotifier } from "@careerden/domain";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";
import { createSupportRouter } from "./support.routes.js";

describe("createSupportRouter", () => {
  const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  it("submits validated details with the authenticated actor", async () => {
    const notifier: SupportRequestNotifier = { notify: vi.fn(async () => undefined) };
    const response = await requestSupport(new SubmitSupportRequestUseCase(notifier), {
      reason: "feature_request",
      description: "  Please add a compact document preview.  ",
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(notifier.notify).toHaveBeenCalledWith({
      user: { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" },
      reason: "feature_request",
      description: "Please add a compact document preview.",
    });
  });

  it("rejects invalid request bodies before invoking the use case", async () => {
    const notifier: SupportRequestNotifier = { notify: vi.fn(async () => undefined) };
    const response = await requestSupport(new SubmitSupportRequestUseCase(notifier), {
      reason: "unsupported",
      description: "Too short",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "validation",
      error: "Invalid request body",
    });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  async function requestSupport(
    useCase: SubmitSupportRequestUseCase,
    body: Record<string, unknown>,
  ) {
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
      (request as AuthenticatedRequest).user = {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      };
      next();
    });
    app.use("/support", createSupportRouter({ submitSupportRequest: useCase }));

    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    return fetch(`http://127.0.0.1:${port}/support/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
});

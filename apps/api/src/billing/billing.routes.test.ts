import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";
import { createBillingRouter } from "./billing.routes.js";

describe("createBillingRouter", () => {
  const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  it("returns only the authenticated user's authoritative balance", async () => {
    const getCreditBalance = {
      execute: vi.fn(async () => ({
        totalCredits: 10,
        availableCredits: 10,
        reservedCredits: 0,
      })),
    };
    const app = express();
    app.use((request, _response, next) => {
      (request as AuthenticatedRequest).user = {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      };
      next();
    });
    app.use("/billing", createBillingRouter({ getCreditBalance }));
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/billing/credits?userId=user-2`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalCredits: 10,
      availableCredits: 10,
      reservedCredits: 0,
    });
    expect(getCreditBalance.execute).toHaveBeenCalledWith("user-1");
  });
});

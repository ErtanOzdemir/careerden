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
    const getBillingSubscription = { execute: vi.fn(async () => null) };
    const createCheckout = {
      execute: vi.fn(async () => ({ url: "https://checkout.creem.io/ch_123" })),
    };
    const createPortal = {
      execute: vi.fn(async () => ({ url: "https://creem.io/portal/cust_123" })),
    };
    app.use(
      "/billing",
      createBillingRouter({
        getCreditBalance,
        getBillingSubscription,
        createCheckout,
        createPortal,
      }),
    );
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

    const subscriptionResponse = await fetch(`http://127.0.0.1:${port}/billing/subscription`);
    expect(subscriptionResponse.status).toBe(200);
    await expect(subscriptionResponse.json()).resolves.toBeNull();
    expect(getBillingSubscription.execute).toHaveBeenCalledWith("user-1");

    const checkoutResponse = await fetch(`http://127.0.0.1:${port}/billing/checkout`, {
      method: "POST",
    });
    await expect(checkoutResponse.json()).resolves.toEqual({
      url: "https://checkout.creem.io/ch_123",
    });
    expect(createCheckout.execute).toHaveBeenCalledWith({
      id: "user-1",
      email: "ada@example.com",
    });

    const portalResponse = await fetch(`http://127.0.0.1:${port}/billing/portal`, {
      method: "POST",
    });
    await expect(portalResponse.json()).resolves.toEqual({
      url: "https://creem.io/portal/cust_123",
    });
    expect(createPortal.execute).toHaveBeenCalledWith("user-1");
  });
});

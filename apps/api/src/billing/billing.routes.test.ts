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
        listCreditActivity: { execute: vi.fn(async () => []) },
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

  it("returns the authenticated user's credit activity and payments", async () => {
    const listCreditActivity = {
      execute: vi.fn(async () => [
        {
          id: "ledger-2",
          kind: "analysis_usage" as const,
          delta: -1,
          occurredAt: new Date("2026-10-12T10:00:00.000Z"),
          jobApplication: {
            id: "job-1",
            deleted: false,
            roleTitle: "Engineer",
            companyName: "Acme",
          },
        },
        {
          id: "ledger-1",
          kind: "free_monthly_grant" as const,
          delta: 10,
          occurredAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ]),
    };
    const listPayments = {
      execute: vi.fn(async () => [
        {
          id: "tran_1",
          status: "paid" as const,
          currency: "USD",
          amountMinor: 900,
          amountPaidMinor: 900,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ]),
    };
    const port = await startBillingServer({ listCreditActivity, listPayments });

    const activityResponse = await fetch(`http://127.0.0.1:${port}/billing/credit-activity`);
    expect(activityResponse.status).toBe(200);
    await expect(activityResponse.json()).resolves.toEqual({
      items: [
        {
          id: "ledger-2",
          kind: "analysis_usage",
          delta: -1,
          occurredAt: "2026-10-12T10:00:00.000Z",
          jobApplication: {
            id: "job-1",
            deleted: false,
            roleTitle: "Engineer",
            companyName: "Acme",
          },
        },
        {
          id: "ledger-1",
          kind: "free_monthly_grant",
          delta: 10,
          occurredAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
    expect(listCreditActivity.execute).toHaveBeenCalledWith("user-1");

    const paymentsResponse = await fetch(`http://127.0.0.1:${port}/billing/payments?userId=user-2`);
    expect(paymentsResponse.status).toBe(200);
    await expect(paymentsResponse.json()).resolves.toEqual({
      items: [
        {
          id: "tran_1",
          status: "paid",
          currency: "USD",
          amountMinor: 900,
          amountPaidMinor: 900,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
    expect(listPayments.execute).toHaveBeenCalledWith("user-1");
  });

  it("returns no payments when billing is not configured", async () => {
    const port = await startBillingServer({
      listCreditActivity: { execute: vi.fn(async () => []) },
    });

    const response = await fetch(`http://127.0.0.1:${port}/billing/payments`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  async function startBillingServer(
    dependencies: Pick<
      Parameters<typeof createBillingRouter>[0],
      "listCreditActivity" | "listPayments"
    >,
  ): Promise<number> {
    const app = express();
    app.use((request, _response, next) => {
      (request as AuthenticatedRequest).user = {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      };
      next();
    });
    app.use(
      "/billing",
      createBillingRouter({
        getCreditBalance: { execute: vi.fn() },
        getBillingSubscription: { execute: vi.fn(async () => null) },
        ...dependencies,
      }),
    );
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return (server.address() as AddressInfo).port;
  }
});

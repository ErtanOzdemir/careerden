import { createHmac } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreemWebhookEventParser } from "@careerden/infrastructure";
import { createCreemWebhookRouter } from "./creem-webhook.routes.js";

describe("createCreemWebhookRouter", () => {
  const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];
  const secret = "test-webhook-secret-123456";

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  it("verifies the raw signed body before processing a cancellation", async () => {
    const processEvent = { execute: vi.fn(async () => ({ processed: true })) };
    const port = await startServer(processEvent);
    const body = JSON.stringify({
      id: "evt-cancel",
      eventType: "subscription.canceled",
      created_at: 1_752_537_600_000,
      object: {
        id: "sub-1",
        object: "subscription",
        product: { id: "prod-1" },
        customer: { id: "cust-1" },
        status: "canceled",
        current_period_start_date: "2026-07-01T00:00:00.000Z",
        current_period_end_date: "2026-08-01T00:00:00.000Z",
        metadata: { userId: "user-1" },
      },
    });

    const response = await fetch(`http://127.0.0.1:${port}/billing/webhooks/creem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "creem-signature": createHmac("sha256", secret).update(body).digest("hex"),
      },
      body,
    });

    expect(response.status).toBe(200);
    expect(processEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: "evt-cancel",
        eventType: "subscription_canceled",
      }),
    );
  });

  it("rejects an invalid signature without processing the event", async () => {
    const processEvent = { execute: vi.fn() };
    const port = await startServer(processEvent);

    const response = await fetch(`http://127.0.0.1:${port}/billing/webhooks/creem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "creem-signature": "0".repeat(64),
      },
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(processEvent.execute).not.toHaveBeenCalled();
  });

  async function startServer(processEvent: { execute: ReturnType<typeof vi.fn> }): Promise<number> {
    const app = express();
    app.use(
      "/billing/webhooks/creem",
      createCreemWebhookRouter({
        parser: new CreemWebhookEventParser({
          webhookSecret: secret,
          productId: "prod-1",
          planKey: "pro",
        }),
        processEvent,
      }),
    );
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return (server.address() as AddressInfo).port;
  }
});

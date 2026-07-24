import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CreemWebhookEventParser,
  CreemWebhookSignatureError,
} from "./creem-webhook-event.parser.js";

describe("CreemWebhookEventParser", () => {
  const secret = "test-webhook-secret-123456";
  const parser = new CreemWebhookEventParser({
    webhookSecret: secret,
    productId: "prod-1",
    planKey: "pro",
  });

  it("verifies the raw body and normalizes paid subscription cycles", () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        id: "evt-1",
        eventType: "subscription.paid",
        created_at: 1_752_537_600_000,
        object: {
          id: "sub-1",
          object: "subscription",
          product: { id: "prod-1" },
          customer: { id: "cust-1" },
          status: "active",
          last_transaction_id: "tran-1",
          current_period_start_date: "2026-07-01T00:00:00.000Z",
          current_period_end_date: "2026-08-01T00:00:00.000Z",
          metadata: { userId: "user-1", planKey: "pro" },
        },
      }),
    );

    expect(parser.parseAndVerify(rawBody, sign(rawBody, secret))).toMatchObject({
      provider: "creem",
      providerEventId: "evt-1",
      eventType: "subscription_paid",
      userId: "user-1",
      providerCustomerId: "cust-1",
      providerSubscriptionId: "sub-1",
      providerTransactionId: "tran-1",
      status: "active",
    });
  });

  it("normalizes end-of-period cancellation without granting another cycle", () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        id: "evt-2",
        eventType: "subscription.scheduled_cancel",
        created_at: 1_752_537_600_000,
        object: {
          id: "sub-1",
          object: "subscription",
          product: { id: "prod-1" },
          customer: { id: "cust-1" },
          status: "active",
          current_period_start_date: "2026-07-01T00:00:00.000Z",
          current_period_end_date: "2026-08-01T00:00:00.000Z",
          metadata: { userId: "user-1" },
        },
      }),
    );

    expect(parser.parseAndVerify(rawBody, sign(rawBody, secret))).toMatchObject({
      eventType: "subscription_scheduled_cancel",
      cancelAtPeriodEnd: true,
    });
  });

  it("rejects a signature that was not calculated from the exact raw body", () => {
    const rawBody = Buffer.from("{}");
    expect(() => parser.parseAndVerify(rawBody, "0".repeat(64))).toThrow(
      CreemWebhookSignatureError,
    );
  });
});

function sign(rawBody: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

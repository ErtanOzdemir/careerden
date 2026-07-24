import { describe, expect, it } from "vitest";
import {
  billingRedirectSchema,
  billingSubscriptionResponseSchema,
} from "./billing-subscription.schema.js";

describe("billing subscription contracts", () => {
  it("accepts redirect and current subscription responses", () => {
    expect(billingRedirectSchema.parse({ url: "https://checkout.creem.io/ch_123" })).toEqual({
      url: "https://checkout.creem.io/ch_123",
    });
    expect(
      billingSubscriptionResponseSchema.parse({
        provider: "creem",
        planKey: "pro",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
    ).toMatchObject({ status: "active" });
  });

  it("accepts an account without a paid subscription", () => {
    expect(billingSubscriptionResponseSchema.parse(null)).toBeNull();
  });
});

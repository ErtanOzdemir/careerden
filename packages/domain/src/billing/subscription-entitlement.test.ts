import { describe, expect, it } from "vitest";
import type { BillingSubscriptionStatus } from "./billing-subscription.js";
import { aiTierForSubscription, hasPaidSubscriptionAccess } from "./subscription-entitlement.js";

const now = new Date("2026-10-18T12:00:00.000Z");
const future = new Date("2026-11-01T00:00:00.000Z");
const past = new Date("2026-10-01T00:00:00.000Z");

describe("subscription entitlement", () => {
  it("denies paid access without a subscription", () => {
    expect(hasPaidSubscriptionAccess(null, now)).toBe(false);
    expect(aiTierForSubscription(null, now)).toBe("free");
  });

  it.each(["active", "past_due", "canceled"] satisfies BillingSubscriptionStatus[])(
    "keeps paid access for %s subscriptions inside the paid period",
    (status) => {
      expect(hasPaidSubscriptionAccess({ status, currentPeriodEnd: future }, now)).toBe(true);
      expect(aiTierForSubscription({ status, currentPeriodEnd: future }, now)).toBe("premium");
    },
  );

  it.each(["active", "past_due", "canceled"] satisfies BillingSubscriptionStatus[])(
    "denies paid access for %s subscriptions after the paid period",
    (status) => {
      expect(hasPaidSubscriptionAccess({ status, currentPeriodEnd: past }, now)).toBe(false);
      expect(hasPaidSubscriptionAccess({ status, currentPeriodEnd: now }, now)).toBe(false);
    },
  );

  it("denies paid access for expired subscriptions even inside the period", () => {
    expect(hasPaidSubscriptionAccess({ status: "expired", currentPeriodEnd: future }, now)).toBe(
      false,
    );
    expect(aiTierForSubscription({ status: "expired", currentPeriodEnd: future }, now)).toBe(
      "free",
    );
  });
});

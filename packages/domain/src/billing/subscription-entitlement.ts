import type { AiTier } from "../matching/ai-provider.js";
import type { BillingSubscription } from "./billing-subscription.js";

/**
 * A subscriber keeps paid access until the provider-confirmed period ends, including after a
 * scheduled or completed cancellation and while a renewal payment is past due.
 */
export function hasPaidSubscriptionAccess(
  subscription: Pick<BillingSubscription, "status" | "currentPeriodEnd"> | null,
  now: Date,
): boolean {
  if (!subscription || subscription.status === "expired") return false;
  return subscription.currentPeriodEnd.getTime() > now.getTime();
}

export function aiTierForSubscription(
  subscription: Pick<BillingSubscription, "status" | "currentPeriodEnd"> | null,
  now: Date,
): AiTier {
  return hasPaidSubscriptionAccess(subscription, now) ? "premium" : "free";
}

import type { AiTier, BillingSubscriptionRepository } from "@careerden/domain";
import { aiTierForSubscription } from "@careerden/domain";

export async function resolveAiTier(
  subscriptions: Pick<BillingSubscriptionRepository, "findByUserId">,
  userId: string,
  now: Date,
): Promise<AiTier> {
  return aiTierForSubscription(await subscriptions.findByUserId(userId), now);
}

import type { BillingSubscription, BillingSubscriptionRepository } from "@careerden/domain";

export class GetBillingSubscriptionUseCase {
  constructor(private readonly subscriptions: BillingSubscriptionRepository) {}

  async execute(userId: string): Promise<BillingSubscription | null> {
    return this.subscriptions.findByUserId(userId);
  }
}

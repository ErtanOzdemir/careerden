import type { BillingSubscriptionRepository, SubscriptionBillingProvider } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";

export class CreateBillingPortalUseCase {
  constructor(
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly provider: SubscriptionBillingProvider,
  ) {}

  async execute(userId: string): Promise<{ url: string }> {
    const subscription = await this.subscriptions.findByUserId(userId);
    if (!subscription) {
      throw new ApplicationError("not_found", "No billing subscription was found");
    }
    return this.provider.createCustomerPortal(subscription.providerCustomerId);
  }
}

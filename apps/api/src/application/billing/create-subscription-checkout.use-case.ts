import type { SubscriptionBillingProvider } from "@careerden/domain";

export class CreateSubscriptionCheckoutUseCase {
  constructor(private readonly provider: SubscriptionBillingProvider) {}

  async execute(user: { id: string; email: string }): Promise<{ url: string }> {
    return this.provider.createCheckout({
      userId: user.id,
      email: user.email,
    });
  }
}

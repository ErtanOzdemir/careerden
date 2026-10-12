import type { BillingSubscriptionRepository } from "@careerden/domain";
import type {
  BillingPayment,
  BillingPaymentHistoryProvider,
} from "../../domain/billing/billing-payment.js";

export const billingPaymentHistoryLimit = 24;

export class ListBillingPaymentsUseCase {
  constructor(
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly provider: BillingPaymentHistoryProvider,
  ) {}

  /** Users without a provider subscription have never paid, so the provider is not queried. */
  async execute(userId: string): Promise<BillingPayment[]> {
    const subscription = await this.subscriptions.findByUserId(userId);
    if (!subscription) return [];
    return this.provider.listPayments(subscription.providerCustomerId, billingPaymentHistoryLimit);
  }
}

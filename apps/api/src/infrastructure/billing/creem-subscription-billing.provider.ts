import { randomUUID } from "node:crypto";
import { Creem } from "creem";
import type {
  CreateSubscriptionCheckoutInput,
  SubscriptionBillingProvider,
} from "@careerden/domain";
import type {
  BillingPayment,
  BillingPaymentHistoryProvider,
  BillingPaymentStatus,
} from "../../domain/billing/billing-payment.js";

interface CreemClient {
  checkouts: {
    create(input: {
      productId: string;
      requestId: string;
      successUrl: string;
      customer: { email: string };
      metadata: Record<string, string>;
    }): Promise<{ checkoutUrl?: string }>;
  };
  customers: {
    generateBillingLinks(input: { customerId: string }): Promise<{ customerPortalLink: string }>;
  };
  transactions: {
    search(
      customerId?: string,
      orderId?: string,
      productId?: string,
      pageNumber?: number,
      pageSize?: number,
    ): Promise<{ result: { items: CreemTransaction[] } }>;
  };
}

interface CreemTransaction {
  id: string;
  status: string;
  currency: string;
  amount: number;
  amountPaid?: number | null;
  refundedAmount?: number | null;
  taxAmount?: number | null;
  periodStart?: number;
  periodEnd?: number;
  createdAt: number;
}

const creemPaymentStatuses: Record<string, BillingPaymentStatus> = {
  pending: "pending",
  paid: "paid",
  refunded: "refunded",
  partialRefund: "partially_refunded",
  chargedBack: "charged_back",
  declined: "failed",
  uncollectible: "failed",
  canceled: "canceled",
  void: "canceled",
};

export interface CreemSubscriptionBillingProviderOptions {
  apiKey: string;
  productId: string;
  planKey: string;
  successUrl: string;
  testMode: boolean;
}

export class CreemSubscriptionBillingProvider
  implements SubscriptionBillingProvider, BillingPaymentHistoryProvider
{
  readonly provider = "creem";
  private readonly client: CreemClient;

  constructor(
    private readonly options: CreemSubscriptionBillingProviderOptions,
    client?: CreemClient,
  ) {
    this.client =
      client ??
      new Creem({
        apiKey: options.apiKey,
        server: options.testMode ? "test" : "prod",
      });
  }

  async createCheckout(input: CreateSubscriptionCheckoutInput): Promise<{ url: string }> {
    const checkout = await this.client.checkouts.create({
      productId: this.options.productId,
      requestId: randomUUID(),
      successUrl: this.options.successUrl,
      customer: { email: input.email },
      metadata: {
        userId: input.userId,
        planKey: this.options.planKey,
      },
    });
    if (!checkout.checkoutUrl) throw new Error("Creem checkout response did not include a URL");
    return { url: checkout.checkoutUrl };
  }

  async createCustomerPortal(providerCustomerId: string): Promise<{ url: string }> {
    const links = await this.client.customers.generateBillingLinks({
      customerId: providerCustomerId,
    });
    return { url: links.customerPortalLink };
  }

  /** Lists this product's payments for one customer, newest first, as reported by Creem. */
  async listPayments(providerCustomerId: string, limit: number): Promise<BillingPayment[]> {
    const page = await this.client.transactions.search(
      providerCustomerId,
      undefined,
      this.options.productId,
      1,
      limit,
    );

    return page.result.items
      .map(toBillingPayment)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

function toBillingPayment(transaction: CreemTransaction): BillingPayment {
  return {
    id: transaction.id,
    status: creemPaymentStatuses[transaction.status] ?? "pending",
    currency: transaction.currency.toUpperCase(),
    amountMinor: transaction.amount,
    amountPaidMinor: transaction.amountPaid ?? undefined,
    refundedAmountMinor: transaction.refundedAmount ?? undefined,
    taxAmountMinor: transaction.taxAmount ?? undefined,
    periodStart: optionalTimestamp(transaction.periodStart),
    periodEnd: optionalTimestamp(transaction.periodEnd),
    createdAt: new Date(transaction.createdAt),
  };
}

function optionalTimestamp(value: number | undefined): Date | undefined {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : undefined;
}

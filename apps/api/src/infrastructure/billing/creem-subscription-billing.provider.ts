import { randomUUID } from "node:crypto";
import { Creem } from "creem";
import type {
  CreateSubscriptionCheckoutInput,
  SubscriptionBillingProvider,
} from "@careerden/domain";

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
}

export interface CreemSubscriptionBillingProviderOptions {
  apiKey: string;
  productId: string;
  planKey: string;
  successUrl: string;
  testMode: boolean;
}

export class CreemSubscriptionBillingProvider implements SubscriptionBillingProvider {
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
}

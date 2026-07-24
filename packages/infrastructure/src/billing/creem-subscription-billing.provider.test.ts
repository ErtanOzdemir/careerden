import { describe, expect, it, vi } from "vitest";
import { CreemSubscriptionBillingProvider } from "./creem-subscription-billing.provider.js";

describe("CreemSubscriptionBillingProvider", () => {
  it("creates user-bound checkouts and customer portal links", async () => {
    const create = vi.fn(async () => ({
      checkoutUrl: "https://checkout.creem.io/ch_123",
    }));
    const generateBillingLinks = vi.fn(async () => ({
      customerPortalLink: "https://creem.io/portal/cust_123",
    }));
    const provider = new CreemSubscriptionBillingProvider(
      {
        apiKey: "creem_test_key",
        productId: "prod-1",
        planKey: "pro",
        successUrl: "https://app.example.com/settings?checkout=success",
        testMode: true,
      },
      {
        checkouts: { create },
        customers: { generateBillingLinks },
      },
    );

    await expect(
      provider.createCheckout({ userId: "user-1", email: "ada@example.com" }),
    ).resolves.toEqual({ url: "https://checkout.creem.io/ch_123" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-1",
        customer: { email: "ada@example.com" },
        metadata: { userId: "user-1", planKey: "pro" },
      }),
    );

    await expect(provider.createCustomerPortal("cust-1")).resolves.toEqual({
      url: "https://creem.io/portal/cust_123",
    });
    expect(generateBillingLinks).toHaveBeenCalledWith({ customerId: "cust-1" });
  });
});

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
        successUrl: "https://app.example.com/billing?checkout=success",
        testMode: true,
      },
      {
        checkouts: { create },
        customers: { generateBillingLinks },
        transactions: { search: vi.fn() },
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

  it("lists this product's customer payments newest first in minor units", async () => {
    const search = vi.fn(async () => ({
      result: {
        items: [
          {
            id: "tran_old",
            status: "refunded",
            currency: "usd",
            amount: 900,
            amountPaid: 900,
            refundedAmount: 900,
            createdAt: Date.parse("2026-08-01T00:00:00.000Z"),
          },
          {
            id: "tran_new",
            status: "partialRefund",
            currency: "eur",
            amount: 1000,
            amountPaid: 1190,
            refundedAmount: 500,
            taxAmount: 190,
            periodStart: Date.parse("2026-09-01T00:00:00.000Z"),
            periodEnd: Date.parse("2026-10-01T00:00:00.000Z"),
            createdAt: Date.parse("2026-09-01T00:00:00.000Z"),
          },
          {
            id: "tran_unknown",
            status: "somethingNew",
            currency: "usd",
            amount: 0,
            amountPaid: null,
            createdAt: Date.parse("2026-07-01T00:00:00.000Z"),
          },
        ],
      },
    }));
    const provider = new CreemSubscriptionBillingProvider(
      {
        apiKey: "creem_test_key",
        productId: "prod-1",
        planKey: "pro",
        successUrl: "https://app.example.com/billing?checkout=success",
        testMode: true,
      },
      {
        checkouts: { create: vi.fn() },
        customers: { generateBillingLinks: vi.fn() },
        transactions: { search },
      },
    );

    const payments = await provider.listPayments("cust-1", 24);

    expect(search).toHaveBeenCalledWith("cust-1", undefined, "prod-1", 1, 24);
    expect(payments.map((payment) => payment.id)).toEqual(["tran_new", "tran_old", "tran_unknown"]);
    expect(payments[0]).toEqual({
      id: "tran_new",
      status: "partially_refunded",
      currency: "EUR",
      amountMinor: 1000,
      amountPaidMinor: 1190,
      refundedAmountMinor: 500,
      taxAmountMinor: 190,
      periodStart: new Date("2026-09-01T00:00:00.000Z"),
      periodEnd: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(payments[1]?.status).toBe("refunded");
    expect(payments[2]).toMatchObject({ status: "pending", amountPaidMinor: undefined });
  });
});

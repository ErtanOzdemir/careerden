import { describe, expect, it, vi } from "vitest";
import type { BillingSubscription, BillingSubscriptionRepository } from "@careerden/domain";
import { ListBillingPaymentsUseCase } from "./list-billing-payments.use-case.js";

describe("ListBillingPaymentsUseCase", () => {
  it("does not query the provider for users who never subscribed", async () => {
    const provider = { listPayments: vi.fn() };
    const useCase = new ListBillingPaymentsUseCase(createSubscriptions(null), provider);

    await expect(useCase.execute("user-1")).resolves.toEqual([]);
    expect(provider.listPayments).not.toHaveBeenCalled();
  });

  it("lists payments for the user's provider customer", async () => {
    const payments = [
      {
        id: "tran_1",
        status: "paid" as const,
        currency: "USD",
        amountMinor: 900,
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    ];
    const provider = { listPayments: vi.fn(async () => payments) };
    const useCase = new ListBillingPaymentsUseCase(
      createSubscriptions({ providerCustomerId: "cust-1" } as BillingSubscription),
      provider,
    );

    await expect(useCase.execute("user-1")).resolves.toBe(payments);
    expect(provider.listPayments).toHaveBeenCalledWith("cust-1", 24);
  });
});

function createSubscriptions(
  subscription: BillingSubscription | null,
): BillingSubscriptionRepository {
  return {
    findByUserId: vi.fn(async () => subscription),
  } as unknown as BillingSubscriptionRepository;
}

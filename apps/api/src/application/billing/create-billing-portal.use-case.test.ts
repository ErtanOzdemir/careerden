import { describe, expect, it, vi } from "vitest";
import type {
  BillingSubscription,
  BillingSubscriptionRepository,
  SubscriptionBillingProvider,
} from "@careerden/domain";
import { CreateBillingPortalUseCase } from "./create-billing-portal.use-case.js";

describe("CreateBillingPortalUseCase", () => {
  it("opens the portal for the user's provider customer", async () => {
    const provider = createProvider();
    const useCase = new CreateBillingPortalUseCase(
      createSubscriptions({ providerCustomerId: "cust-1" } as BillingSubscription),
      provider,
    );

    await expect(useCase.execute("user-1")).resolves.toEqual({ url: "https://portal.test" });
    expect(provider.createCustomerPortal).toHaveBeenCalledWith("cust-1");
  });

  it("reports users who never subscribed as not found", async () => {
    const provider = createProvider();
    const useCase = new CreateBillingPortalUseCase(createSubscriptions(null), provider);

    await expect(useCase.execute("user-1")).rejects.toMatchObject({ code: "not_found" });
    expect(provider.createCustomerPortal).not.toHaveBeenCalled();
  });
});

function createProvider() {
  return {
    provider: "test",
    createCheckout: vi.fn(),
    createCustomerPortal: vi.fn(async () => ({ url: "https://portal.test" })),
  } satisfies SubscriptionBillingProvider;
}

function createSubscriptions(
  subscription: BillingSubscription | null,
): BillingSubscriptionRepository {
  return {
    findByUserId: vi.fn(async () => subscription),
  } as unknown as BillingSubscriptionRepository;
}

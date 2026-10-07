import { describe, expect, it, vi } from "vitest";
import type { NormalizedBillingProviderEvent, PersistenceUnitOfWork } from "@careerden/domain";
import {
  InMemoryBillingSubscriptionRepository,
  InMemoryCreditRepository,
} from "@careerden/infrastructure";
import { ProcessBillingProviderEventUseCase } from "./process-billing-provider-event.use-case.js";

describe("ProcessBillingProviderEventUseCase", () => {
  it("grants one paid-cycle lot and keeps it valid through cancellation", async () => {
    const credits = new InMemoryCreditRepository();
    const subscriptions = new InMemoryBillingSubscriptionRepository();
    const useCase = new ProcessBillingProviderEventUseCase(
      createUnitOfWork(credits, subscriptions),
    );
    const paid = createEvent({
      providerEventId: "evt-paid-1",
      eventType: "subscription_paid",
      originalEventType: "subscription.paid",
      providerTransactionId: "tran-1",
    });

    await expect(useCase.execute(paid)).resolves.toEqual({ processed: true });
    await expect(useCase.execute(paid)).resolves.toEqual({ processed: false });
    await expect(
      credits.getBalance("user-1", new Date("2026-07-15T00:00:00.000Z")),
    ).resolves.toEqual({
      totalCredits: 100,
      availableCredits: 100,
      reservedCredits: 0,
    });
    expect(credits.listGrants()).toHaveLength(1);

    await useCase.execute(
      createEvent({
        providerEventId: "evt-cancel-1",
        eventType: "subscription_scheduled_cancel",
        originalEventType: "subscription.scheduled_cancel",
        userId: undefined,
        cancelAtPeriodEnd: true,
      }),
    );
    expect(await subscriptions.findByUserId("user-1")).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: true,
    });

    await useCase.execute(
      createEvent({
        providerEventId: "evt-canceled-1",
        eventType: "subscription_canceled",
        originalEventType: "subscription.canceled",
        userId: undefined,
        cancelAtPeriodEnd: false,
      }),
    );
    expect(await subscriptions.findByUserId("user-1")).toMatchObject({
      status: "canceled",
      cancelAtPeriodEnd: false,
    });
    await expect(
      credits.getBalance("user-1", new Date("2026-07-31T23:59:59.999Z")),
    ).resolves.toMatchObject({ availableCredits: 100 });
    await expect(
      credits.getBalance("user-1", new Date("2026-08-01T00:00:00.000Z")),
    ).resolves.toMatchObject({ availableCredits: 0 });
  });

  it("records a failed event so a later webhook delivery can retry it", async () => {
    const credits = new InMemoryCreditRepository();
    const subscriptions = new InMemoryBillingSubscriptionRepository();
    const useCase = new ProcessBillingProviderEventUseCase(
      createUnitOfWork(credits, subscriptions),
    );
    const event = createEvent({
      providerEventId: "evt-invalid",
      eventType: "subscription_paid",
      originalEventType: "subscription.paid",
      userId: undefined,
      providerSubscriptionId: undefined,
    });

    await expect(useCase.execute(event)).rejects.toMatchObject({ code: "validation" });
    expect(subscriptions.getProviderEvent("creem", "evt-invalid")).toMatchObject({
      status: "failed",
    });
  });
});

function createEvent(
  overrides: Partial<NormalizedBillingProviderEvent>,
): NormalizedBillingProviderEvent {
  return {
    provider: "creem",
    providerEventId: "evt-1",
    eventType: "subscription_paid",
    originalEventType: "subscription.paid",
    userId: "user-1",
    providerCustomerId: "cust-1",
    providerSubscriptionId: "sub-1",
    providerTransactionId: "tran-1",
    planKey: "pro",
    status: "active",
    currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    payload: {},
    receivedAt: new Date("2026-07-01T00:00:01.000Z"),
    ...overrides,
  };
}

function createUnitOfWork(
  credits: InMemoryCreditRepository,
  billingSubscriptions: InMemoryBillingSubscriptionRepository,
): PersistenceUnitOfWork {
  return {
    execute: (work) =>
      work({
        billingSubscriptions,
        credits,
        jobApplications: {} as never,
        jobApplicationChanges: { changed: vi.fn(), deleted: vi.fn() },
        profiles: {} as never,
        notifications: {} as never,
        notificationChanges: {} as never,
        followUpReminders: {} as never,
        outbox: {} as never,
      }),
  };
}

import { randomUUID } from "node:crypto";
import type {
  BillingSubscription,
  BillingSubscriptionRepository,
  NormalizedBillingProviderEvent,
  UpsertBillingSubscriptionInput,
} from "@careerden/domain";

interface StoredProviderEvent {
  status: "pending" | "processed" | "failed";
  error?: string;
  event: NormalizedBillingProviderEvent;
}

export class InMemoryBillingSubscriptionRepository implements BillingSubscriptionRepository {
  private readonly subscriptions = new Map<string, BillingSubscription>();
  private readonly events = new Map<string, StoredProviderEvent>();

  async findByUserId(userId: string): Promise<BillingSubscription | null> {
    const subscription = [...this.subscriptions.values()]
      .filter((candidate) => candidate.userId === userId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
    return subscription ? structuredClone(subscription) : null;
  }

  async findByProviderSubscriptionId(
    provider: string,
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    const subscription = this.subscriptions.get(`${provider}:${providerSubscriptionId}`);
    return subscription ? structuredClone(subscription) : null;
  }

  async upsert(input: UpsertBillingSubscriptionInput): Promise<BillingSubscription> {
    const key = `${input.provider}:${input.providerSubscriptionId}`;
    const existing = this.subscriptions.get(key);
    const subscription: BillingSubscription = {
      id: existing?.id ?? randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      planKey: input.planKey,
      status: input.status,
      currentPeriodStart: new Date(input.currentPeriodStart),
      currentPeriodEnd: new Date(input.currentPeriodEnd),
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      createdAt: existing?.createdAt ?? new Date(input.updatedAt),
      updatedAt: new Date(input.updatedAt),
    };
    this.subscriptions.set(key, subscription);
    return structuredClone(subscription);
  }

  async beginProviderEvent(
    event: NormalizedBillingProviderEvent,
  ): Promise<{ shouldProcess: boolean }> {
    const key = `${event.provider}:${event.providerEventId}`;
    const existing = this.events.get(key);
    if (existing?.status === "processed") return { shouldProcess: false };
    this.events.set(key, { status: "pending", event: structuredClone(event) });
    return { shouldProcess: true };
  }

  async markProviderEventProcessed(
    provider: string,
    providerEventId: string,
    _processedAt: Date,
  ): Promise<void> {
    const stored = this.events.get(`${provider}:${providerEventId}`);
    if (!stored) throw new Error("Billing provider event was not found");
    stored.status = "processed";
    stored.error = undefined;
  }

  async recordProviderEventFailure(
    event: NormalizedBillingProviderEvent,
    error: string,
    _processedAt: Date,
  ): Promise<void> {
    const key = `${event.provider}:${event.providerEventId}`;
    const existing = this.events.get(key);
    if (existing?.status === "processed") return;
    this.events.set(key, {
      status: "failed",
      error,
      event: structuredClone(event),
    });
  }

  listSubscriptions(): BillingSubscription[] {
    return [...this.subscriptions.values()].map((subscription) => structuredClone(subscription));
  }

  getProviderEvent(provider: string, providerEventId: string): StoredProviderEvent | undefined {
    const event = this.events.get(`${provider}:${providerEventId}`);
    return event ? structuredClone(event) : undefined;
  }
}

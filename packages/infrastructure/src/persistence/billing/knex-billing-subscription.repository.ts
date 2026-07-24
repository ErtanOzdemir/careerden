import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import type {
  BillingSubscription,
  BillingSubscriptionRepository,
  NormalizedBillingProviderEvent,
  UpsertBillingSubscriptionInput,
} from "@careerden/domain";

export class KnexBillingSubscriptionRepository implements BillingSubscriptionRepository {
  constructor(private readonly db: Knex) {}

  async findByUserId(userId: string): Promise<BillingSubscription | null> {
    const row = await this.db("billing_subscriptions")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .first();
    return row ? toBillingSubscription(row as Record<string, unknown>) : null;
  }

  async findByProviderSubscriptionId(
    provider: string,
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    const row = await this.db("billing_subscriptions")
      .where({
        provider,
        provider_subscription_id: providerSubscriptionId,
      })
      .first();
    return row ? toBillingSubscription(row as Record<string, unknown>) : null;
  }

  async upsert(input: UpsertBillingSubscriptionInput): Promise<BillingSubscription> {
    const [row] = await this.db("billing_subscriptions")
      .insert({
        id: randomUUID(),
        user_id: input.userId,
        provider: input.provider,
        provider_customer_id: input.providerCustomerId,
        provider_subscription_id: input.providerSubscriptionId,
        plan_key: input.planKey,
        status: input.status,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        cancel_at_period_end: input.cancelAtPeriodEnd,
        created_at: input.updatedAt,
        updated_at: input.updatedAt,
      })
      .onConflict(["provider", "provider_subscription_id"])
      .merge({
        user_id: input.userId,
        provider_customer_id: input.providerCustomerId,
        plan_key: input.planKey,
        status: input.status,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        cancel_at_period_end: input.cancelAtPeriodEnd,
        updated_at: input.updatedAt,
      })
      .returning("*");
    if (!row) throw new Error("Billing subscription upsert returned no row");
    return toBillingSubscription(row as Record<string, unknown>);
  }

  async beginProviderEvent(
    event: NormalizedBillingProviderEvent,
  ): Promise<{ shouldProcess: boolean }> {
    await this.db("billing_provider_events")
      .insert({
        provider: event.provider,
        provider_event_id: event.providerEventId,
        event_type: event.originalEventType,
        user_id: event.userId ?? null,
        payload: JSON.stringify(event.payload),
        processing_status: "pending",
        error: null,
        received_at: event.receivedAt,
        processed_at: null,
      })
      .onConflict(["provider", "provider_event_id"])
      .ignore();

    const existing = await this.db("billing_provider_events")
      .where({
        provider: event.provider,
        provider_event_id: event.providerEventId,
      })
      .forUpdate()
      .first<{ processing_status: string }>();
    if (!existing) throw new Error("Billing provider event could not be loaded");
    if (existing.processing_status === "processed") return { shouldProcess: false };

    await this.db("billing_provider_events")
      .where({
        provider: event.provider,
        provider_event_id: event.providerEventId,
      })
      .update({
        event_type: event.originalEventType,
        user_id: event.userId ?? null,
        payload: JSON.stringify(event.payload),
        processing_status: "pending",
        error: null,
        received_at: event.receivedAt,
        processed_at: null,
      });
    return { shouldProcess: true };
  }

  async markProviderEventProcessed(
    provider: string,
    providerEventId: string,
    processedAt: Date,
  ): Promise<void> {
    await this.db("billing_provider_events")
      .where({ provider, provider_event_id: providerEventId })
      .update({
        processing_status: "processed",
        error: null,
        processed_at: processedAt,
      });
  }

  async recordProviderEventFailure(
    event: NormalizedBillingProviderEvent,
    error: string,
    processedAt: Date,
  ): Promise<void> {
    const existing = await this.db("billing_provider_events")
      .where({
        provider: event.provider,
        provider_event_id: event.providerEventId,
      })
      .forUpdate()
      .first<{ processing_status: string }>();
    if (existing?.processing_status === "processed") return;

    if (existing) {
      await this.db("billing_provider_events")
        .where({
          provider: event.provider,
          provider_event_id: event.providerEventId,
        })
        .update({
          event_type: event.originalEventType,
          user_id: event.userId ?? null,
          payload: JSON.stringify(event.payload),
          processing_status: "failed",
          error,
          processed_at: processedAt,
        });
      return;
    }

    await this.db("billing_provider_events").insert({
      provider: event.provider,
      provider_event_id: event.providerEventId,
      event_type: event.originalEventType,
      user_id: event.userId ?? null,
      payload: JSON.stringify(event.payload),
      processing_status: "failed",
      error,
      received_at: event.receivedAt,
      processed_at: processedAt,
    });
  }
}

function toBillingSubscription(row: Record<string, unknown>): BillingSubscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    provider: String(row.provider),
    providerCustomerId: String(row.provider_customer_id),
    providerSubscriptionId: String(row.provider_subscription_id),
    planKey: String(row.plan_key),
    status: row.status as BillingSubscription["status"],
    currentPeriodStart: new Date(String(row.current_period_start)),
    currentPeriodEnd: new Date(String(row.current_period_end)),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

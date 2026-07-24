import type {
  BillingSubscription,
  BillingSubscriptionStatus,
  NormalizedBillingProviderEvent,
} from "./billing-subscription.js";

export interface UpsertBillingSubscriptionInput {
  userId: string;
  provider: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
  planKey: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  updatedAt: Date;
}

export interface BillingProviderEventStartResult {
  shouldProcess: boolean;
}

export interface BillingSubscriptionRepository {
  findByUserId(userId: string): Promise<BillingSubscription | null>;
  findByProviderSubscriptionId(
    provider: string,
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null>;
  upsert(input: UpsertBillingSubscriptionInput): Promise<BillingSubscription>;
  beginProviderEvent(
    event: NormalizedBillingProviderEvent,
  ): Promise<BillingProviderEventStartResult>;
  markProviderEventProcessed(
    provider: string,
    providerEventId: string,
    processedAt: Date,
  ): Promise<void>;
  recordProviderEventFailure(
    event: NormalizedBillingProviderEvent,
    error: string,
    processedAt: Date,
  ): Promise<void>;
}

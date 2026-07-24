export type BillingSubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export interface BillingSubscription {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
  planKey: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NormalizedBillingProviderEventType =
  | "ignored"
  | "subscription_active"
  | "subscription_canceled"
  | "subscription_expired"
  | "subscription_paid"
  | "subscription_past_due"
  | "subscription_scheduled_cancel"
  | "subscription_updated";

export interface NormalizedBillingProviderEvent {
  provider: string;
  providerEventId: string;
  eventType: NormalizedBillingProviderEventType;
  originalEventType: string;
  userId?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerTransactionId?: string;
  planKey?: string;
  status?: BillingSubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  payload: Record<string, unknown>;
  receivedAt: Date;
}

export interface CreateSubscriptionCheckoutInput {
  userId: string;
  email: string;
}

export interface SubscriptionBillingProvider {
  readonly provider: string;
  createCheckout(input: CreateSubscriptionCheckoutInput): Promise<{ url: string }>;
  createCustomerPortal(providerCustomerId: string): Promise<{ url: string }>;
}

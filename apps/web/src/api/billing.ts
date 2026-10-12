import { requestJson } from "./client.js";

export interface ApiCreditBalance {
  totalCredits: number;
  availableCredits: number;
  reservedCredits: number;
}

export type ApiBillingSubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export interface ApiBillingSubscription {
  provider: string;
  planKey: string;
  status: ApiBillingSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface ApiBillingRedirect {
  url: string;
}

export type ApiBillingPaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "charged_back"
  | "failed"
  | "canceled";

export interface ApiBillingPayment {
  id: string;
  status: ApiBillingPaymentStatus;
  currency: string;
  amountMinor: number;
  amountPaidMinor?: number;
  refundedAmountMinor?: number;
  taxAmountMinor?: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

export type ApiCreditActivityKind = "free_monthly_grant" | "subscription_grant" | "analysis_usage";

export interface ApiCreditActivity {
  id: string;
  kind: ApiCreditActivityKind;
  delta: number;
  occurredAt: string;
  jobApplication?: {
    id: string;
    deleted: boolean;
    roleTitle?: string;
    companyName?: string;
  };
}

export async function redirectToBillingUrl(url: string): Promise<void> {
  const openExternal = window.electronAPI?.openExternal;
  if (openExternal) {
    await openExternal(url);
    return;
  }

  window.location.assign(url);
}

export const billingApi = {
  getCredits(): Promise<ApiCreditBalance> {
    return requestJson<ApiCreditBalance>("/billing/credits");
  },

  getSubscription(): Promise<ApiBillingSubscription | null> {
    return requestJson<ApiBillingSubscription | null>("/billing/subscription");
  },

  async listPayments(): Promise<ApiBillingPayment[]> {
    return (await requestJson<{ items: ApiBillingPayment[] }>("/billing/payments")).items;
  },

  async listCreditActivity(): Promise<ApiCreditActivity[]> {
    return (await requestJson<{ items: ApiCreditActivity[] }>("/billing/credit-activity")).items;
  },

  createCheckout(): Promise<ApiBillingRedirect> {
    return requestJson<ApiBillingRedirect>("/billing/checkout", { method: "POST" });
  },

  createPortal(): Promise<ApiBillingRedirect> {
    return requestJson<ApiBillingRedirect>("/billing/portal", { method: "POST" });
  },
};

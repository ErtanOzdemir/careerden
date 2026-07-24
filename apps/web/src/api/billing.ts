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

  createCheckout(): Promise<ApiBillingRedirect> {
    return requestJson<ApiBillingRedirect>("/billing/checkout", { method: "POST" });
  },

  createPortal(): Promise<ApiBillingRedirect> {
    return requestJson<ApiBillingRedirect>("/billing/portal", { method: "POST" });
  },
};

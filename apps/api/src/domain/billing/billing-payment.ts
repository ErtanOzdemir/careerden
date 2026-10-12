export type BillingPaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "charged_back"
  | "failed"
  | "canceled";

/** A payment collected by the billing provider, with amounts in the currency's minor unit. */
export interface BillingPayment {
  id: string;
  status: BillingPaymentStatus;
  currency: string;
  amountMinor: number;
  amountPaidMinor?: number;
  refundedAmountMinor?: number;
  taxAmountMinor?: number;
  periodStart?: Date;
  periodEnd?: Date;
  createdAt: Date;
}

export interface BillingPaymentHistoryProvider {
  listPayments(providerCustomerId: string, limit: number): Promise<BillingPayment[]>;
}

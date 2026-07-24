export type CreditGrantSource = "free_monthly" | "subscription_cycle";

export interface CreditBalance {
  totalCredits: number;
  availableCredits: number;
  reservedCredits: number;
}

export interface CreditGrant {
  id: string;
  userId: string;
  sourceType: CreditGrantSource;
  idempotencyKey: string;
  amount: number;
  consumedAmount: number;
  reservedAmount: number;
  validFrom: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  grantId: string;
  entryType: "grant" | "usage";
  delta: number;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

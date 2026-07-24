import type { CreditBalance, CreditGrantSource } from "./credit-account.js";

export interface EnsureCreditGrantInput {
  userId: string;
  sourceType: CreditGrantSource;
  idempotencyKey: string;
  amount: number;
  validFrom: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface EnsureCreditGrantResult {
  created: boolean;
  grantId: string;
}

export interface CreditRepository {
  ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult>;
  getBalance(userId: string, at: Date): Promise<CreditBalance>;
}

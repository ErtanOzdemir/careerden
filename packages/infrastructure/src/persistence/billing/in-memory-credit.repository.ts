import { randomUUID } from "node:crypto";
import type {
  CreditBalance,
  CreditGrant,
  CreditLedgerEntry,
  CreditRepository,
  EnsureCreditGrantInput,
  EnsureCreditGrantResult,
} from "@careerden/domain";

export class InMemoryCreditRepository implements CreditRepository {
  private readonly accounts = new Set<string>();
  private readonly grants = new Map<string, CreditGrant>();
  private readonly grantIdsByIdempotencyKey = new Map<string, string>();
  private readonly ledgerEntries = new Map<string, CreditLedgerEntry>();

  async ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult> {
    this.accounts.add(input.userId);

    const existingGrantId = this.grantIdsByIdempotencyKey.get(input.idempotencyKey);
    if (existingGrantId) {
      return { created: false, grantId: existingGrantId };
    }

    const grantId = randomUUID();
    const grant: CreditGrant = {
      id: grantId,
      userId: input.userId,
      sourceType: input.sourceType,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      consumedAmount: 0,
      reservedAmount: 0,
      validFrom: new Date(input.validFrom),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.createdAt),
    };
    const ledgerIdempotencyKey = `grant:${input.idempotencyKey}`;

    this.grants.set(grantId, grant);
    this.grantIdsByIdempotencyKey.set(input.idempotencyKey, grantId);
    this.ledgerEntries.set(ledgerIdempotencyKey, {
      id: randomUUID(),
      userId: input.userId,
      grantId,
      entryType: "grant",
      delta: input.amount,
      idempotencyKey: ledgerIdempotencyKey,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: new Date(input.createdAt),
    });

    return { created: true, grantId };
  }

  async getBalance(userId: string, at: Date): Promise<CreditBalance> {
    const activeGrants = [...this.grants.values()].filter(
      (grant) =>
        grant.userId === userId &&
        grant.validFrom <= at &&
        (!grant.expiresAt || grant.expiresAt > at),
    );
    const availableCredits = activeGrants.reduce(
      (total, grant) => total + grant.amount - grant.consumedAmount - grant.reservedAmount,
      0,
    );
    const reservedCredits = activeGrants.reduce((total, grant) => total + grant.reservedAmount, 0);

    return {
      totalCredits: availableCredits + reservedCredits,
      availableCredits,
      reservedCredits,
    };
  }

  listGrants(userId?: string): CreditGrant[] {
    return [...this.grants.values()]
      .filter((grant) => !userId || grant.userId === userId)
      .map((grant) => structuredClone(grant));
  }

  listLedgerEntries(userId?: string): CreditLedgerEntry[] {
    return [...this.ledgerEntries.values()]
      .filter((entry) => !userId || entry.userId === userId)
      .map((entry) => structuredClone(entry));
  }
}

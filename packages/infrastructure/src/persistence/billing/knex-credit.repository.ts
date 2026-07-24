import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import type {
  CreditBalance,
  CreditRepository,
  EnsureCreditGrantInput,
  EnsureCreditGrantResult,
} from "@careerden/domain";

interface CreditBalanceRow {
  available_credits: number | string | null;
  reserved_credits: number | string | null;
}

export class KnexCreditRepository implements CreditRepository {
  constructor(private readonly db: Knex) {}

  async ensureGrant(input: EnsureCreditGrantInput): Promise<EnsureCreditGrantResult> {
    await this.db("credit_accounts")
      .insert({
        user_id: input.userId,
        created_at: input.createdAt,
        updated_at: input.createdAt,
      })
      .onConflict("user_id")
      .ignore();

    const grantId = randomUUID();
    const insertedRows = (await this.db("credit_grants")
      .insert({
        id: grantId,
        user_id: input.userId,
        source_type: input.sourceType,
        idempotency_key: input.idempotencyKey,
        amount: input.amount,
        consumed_amount: 0,
        reserved_amount: 0,
        valid_from: input.validFrom,
        expires_at: input.expiresAt ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: input.createdAt,
        updated_at: input.createdAt,
      })
      .onConflict("idempotency_key")
      .ignore()
      .returning("id")) as Array<{ id: string }>;

    if (insertedRows[0]) {
      await this.db("credit_ledger_entries").insert({
        id: randomUUID(),
        user_id: input.userId,
        grant_id: grantId,
        entry_type: "grant",
        delta: input.amount,
        idempotency_key: `grant:${input.idempotencyKey}`,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: input.createdAt,
      });

      return { created: true, grantId };
    }

    const existing = await this.db("credit_grants")
      .select("id")
      .where({ idempotency_key: input.idempotencyKey })
      .first<{ id: string }>();

    if (!existing) {
      throw new Error("Credit grant conflict resolved without an existing grant");
    }

    return { created: false, grantId: existing.id };
  }

  async getBalance(userId: string, at: Date): Promise<CreditBalance> {
    const row = await this.db("credit_grants")
      .where({ user_id: userId })
      .where("valid_from", "<=", at)
      .where((query) => query.whereNull("expires_at").orWhere("expires_at", ">", at))
      .select(
        this.db.raw(
          "coalesce(sum(amount - consumed_amount - reserved_amount), 0) as available_credits",
        ),
        this.db.raw("coalesce(sum(reserved_amount), 0) as reserved_credits"),
      )
      .first<CreditBalanceRow>();
    const availableCredits = Number(row?.available_credits ?? 0);
    const reservedCredits = Number(row?.reserved_credits ?? 0);

    return {
      totalCredits: availableCredits + reservedCredits,
      availableCredits,
      reservedCredits,
    };
  }
}

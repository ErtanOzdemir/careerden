import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import type {
  CreditBalance,
  CreditReservation,
  CreditRepository,
  EnsureCreditGrantInput,
  EnsureCreditGrantResult,
  ListExpiredCreditReservationsInput,
  ReserveCreditsInput,
  ReserveCreditsResult,
  CreditReservationReleaseReason,
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

  async reserve(input: ReserveCreditsInput): Promise<ReserveCreditsResult> {
    const grant = await this.db("credit_grants")
      .where({ user_id: input.userId })
      .where("valid_from", "<=", input.createdAt)
      .where((query) => query.whereNull("expires_at").orWhere("expires_at", ">", input.createdAt))
      .whereRaw("amount - consumed_amount - reserved_amount >= ?", [input.amount])
      .orderByRaw("expires_at asc nulls last")
      .orderBy("created_at", "asc")
      .forUpdate()
      .first<Record<string, unknown>>();

    if (!grant) {
      const balance = await this.getBalance(input.userId, input.createdAt);
      return { reserved: false, availableCredits: balance.availableCredits };
    }

    await this.db("credit_grants")
      .where({ id: grant.id })
      .increment("reserved_amount", input.amount);
    await this.db("credit_reservations").insert({
      id: input.id,
      user_id: input.userId,
      grant_id: grant.id,
      operation_type: input.operationType,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      amount: input.amount,
      status: "reserved",
      expires_at: input.expiresAt,
      release_reason: null,
      created_at: input.createdAt,
      settled_at: null,
    });

    return {
      reserved: true,
      reservation: {
        id: input.id,
        userId: input.userId,
        grantId: String(grant.id),
        operationType: input.operationType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        amount: input.amount,
        status: "reserved",
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(input.createdAt),
      },
    };
  }

  async findReservation(id: string): Promise<CreditReservation | null> {
    const row = await this.db("credit_reservations").where({ id }).first();
    return row ? toCreditReservation(row as Record<string, unknown>) : null;
  }

  async consumeReservation(id: string, settledAt: Date): Promise<boolean> {
    const reservation = await this.db("credit_reservations")
      .where({ id })
      .forUpdate()
      .first<Record<string, unknown>>();
    if (!reservation || reservation.status !== "reserved") {
      return reservation?.status === "consumed";
    }

    const amount = Number(reservation.amount);
    await this.db("credit_grants")
      .where({ id: reservation.grant_id, user_id: reservation.user_id })
      .update({
        reserved_amount: this.db.raw("reserved_amount - ?", [amount]),
        consumed_amount: this.db.raw("consumed_amount + ?", [amount]),
        updated_at: settledAt,
      });
    await this.db("credit_reservations").where({ id }).update({
      status: "consumed",
      settled_at: settledAt,
    });
    await this.db("credit_ledger_entries")
      .insert({
        id: randomUUID(),
        user_id: reservation.user_id,
        grant_id: reservation.grant_id,
        reservation_id: id,
        entry_type: "usage",
        delta: -amount,
        idempotency_key: `usage:${id}`,
        metadata: JSON.stringify({
          operationType: reservation.operation_type,
          resourceType: reservation.resource_type,
          resourceId: reservation.resource_id,
        }),
        created_at: settledAt,
      })
      .onConflict("idempotency_key")
      .ignore();
    return true;
  }

  async releaseReservation(
    id: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<boolean> {
    const reservation = await this.db("credit_reservations")
      .where({ id })
      .forUpdate()
      .first<Record<string, unknown>>();
    if (!reservation || reservation.status !== "reserved") return false;

    await this.db("credit_grants")
      .where({ id: reservation.grant_id, user_id: reservation.user_id })
      .update({
        reserved_amount: this.db.raw("reserved_amount - ?", [Number(reservation.amount)]),
        updated_at: settledAt,
      });
    await this.db("credit_reservations").where({ id }).update({
      status: "released",
      release_reason: reason,
      settled_at: settledAt,
    });
    return true;
  }

  async releaseReservationsForResource(
    operationType: "match_analysis",
    resourceType: "job_application",
    resourceId: string,
    reason: CreditReservationReleaseReason,
    settledAt: Date,
  ): Promise<number> {
    const rows = (await this.db("credit_reservations")
      .select("id")
      .where({
        operation_type: operationType,
        resource_type: resourceType,
        resource_id: resourceId,
        status: "reserved",
      })
      .forUpdate()) as Array<{ id: string }>;
    let released = 0;
    for (const row of rows) {
      if (await this.releaseReservation(row.id, reason, settledAt)) released += 1;
    }
    return released;
  }

  async listExpiredReservations(
    input: ListExpiredCreditReservationsInput,
  ): Promise<CreditReservation[]> {
    const rows = await this.db("credit_reservations")
      .where({ status: "reserved" })
      .where("expires_at", "<=", input.at)
      .orderBy("expires_at", "asc")
      .limit(input.limit)
      .forUpdate()
      .skipLocked();
    return rows.map((row) => toCreditReservation(row as Record<string, unknown>));
  }
}

function toCreditReservation(row: Record<string, unknown>): CreditReservation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    grantId: String(row.grant_id),
    operationType: row.operation_type as CreditReservation["operationType"],
    resourceType: row.resource_type as CreditReservation["resourceType"],
    resourceId: String(row.resource_id),
    amount: Number(row.amount),
    status: row.status as CreditReservation["status"],
    expiresAt: new Date(String(row.expires_at)),
    releaseReason:
      row.release_reason == null
        ? undefined
        : (row.release_reason as CreditReservation["releaseReason"]),
    createdAt: new Date(String(row.created_at)),
    settledAt: row.settled_at == null ? undefined : new Date(String(row.settled_at)),
  };
}

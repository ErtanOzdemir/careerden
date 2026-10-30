import type { Knex } from "knex";
import type { AddOutboxEventInput, OutboxEvent, OutboxRepository } from "@careerden/domain";
import { randomUUID } from "node:crypto";

export interface ClaimedOutboxEvent extends OutboxEvent {
  leaseOwner: string;
}

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: Knex) {}

  async add(input: AddOutboxEventInput): Promise<OutboxEvent> {
    const [row] = await this.db("outbox_events")
      .insert({
        id: randomUUID(),
        type: input.type,
        aggregate_id: input.aggregateId ?? null,
        payload: JSON.stringify(input.payload),
        available_at: input.availableAt ?? this.db.fn.now(),
      })
      .returning("*");

    return toOutboxEvent(row);
  }

  async claimPending(input: {
    types: string[];
    leaseOwner: string;
    leaseDurationMs: number;
    limit: number;
    now?: Date;
  }): Promise<ClaimedOutboxEvent[]> {
    const now = input.now ?? new Date();
    const leaseExpiresAt = new Date(now.getTime() + input.leaseDurationMs);

    return this.db.transaction(async (transaction) => {
      const rows = await transaction("outbox_events")
        .whereIn("type", input.types)
        .whereNull("processed_at")
        .whereNull("dead_lettered_at")
        .where("available_at", "<=", now)
        .andWhere((query) =>
          query.whereNull("lease_expires_at").orWhere("lease_expires_at", "<=", now),
        )
        .orderBy("created_at", "asc")
        .forUpdate()
        .skipLocked()
        .limit(input.limit);

      if (rows.length === 0) return [];

      const ids = rows.map((row) => String(row.id));
      const claimed = await transaction("outbox_events")
        .whereIn("id", ids)
        .update({
          lease_owner: input.leaseOwner,
          lease_expires_at: leaseExpiresAt,
          attempt_count: transaction.raw("attempt_count + 1"),
          updated_at: now,
        })
        .returning("*");

      return claimed.map((row) => ({ ...toOutboxEvent(row), leaseOwner: input.leaseOwner }));
    });
  }

  // Frees leases left by a previous process. Only safe while no other process claims these types.
  async releaseLeases(types: string[], now = new Date()): Promise<number> {
    return this.db("outbox_events")
      .whereIn("type", types)
      .whereNull("processed_at")
      .whereNull("dead_lettered_at")
      .whereNotNull("lease_owner")
      .update({
        lease_owner: null,
        lease_expires_at: null,
        updated_at: now,
      });
  }

  async markProcessed(id: string, leaseOwner: string, now = new Date()): Promise<boolean> {
    const updated = await this.db("outbox_events")
      .where({ id, lease_owner: leaseOwner })
      .whereNull("processed_at")
      .whereNull("dead_lettered_at")
      .update({
        processed_at: now,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: now,
      });
    return updated > 0;
  }

  async markFailed(
    id: string,
    leaseOwner: string,
    error: string,
    availableAt: Date,
  ): Promise<boolean> {
    const updated = await this.db("outbox_events")
      .where({ id, lease_owner: leaseOwner })
      .whereNull("processed_at")
      .whereNull("dead_lettered_at")
      .update({
        available_at: availableAt,
        lease_owner: null,
        lease_expires_at: null,
        last_error: error,
        last_error_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      });
    return updated > 0;
  }

  async markDeadLettered(
    id: string,
    leaseOwner: string,
    error: string,
    now = new Date(),
  ): Promise<boolean> {
    const updated = await this.db("outbox_events")
      .where({ id, lease_owner: leaseOwner })
      .whereNull("processed_at")
      .whereNull("dead_lettered_at")
      .update({
        dead_lettered_at: now,
        lease_owner: null,
        lease_expires_at: null,
        last_error: error,
        last_error_at: now,
        updated_at: now,
      });
    return updated > 0;
  }
}

function toOutboxEvent(row: Record<string, unknown>): OutboxEvent {
  const payload =
    typeof row.payload === "string"
      ? (JSON.parse(row.payload) as Record<string, unknown>)
      : (row.payload as Record<string, unknown>);
  return {
    id: String(row.id),
    type: String(row.type),
    aggregateId: typeof row.aggregate_id === "string" ? row.aggregate_id : undefined,
    payload,
    availableAt: new Date(String(row.available_at)),
    attemptCount: Number(row.attempt_count),
    createdAt: new Date(String(row.created_at)),
  };
}

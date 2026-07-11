import type { JobApplicationChange, JobApplicationChangePublisher } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 50;
const leaseDurationMs = 30_000;
const maximumBackoffMs = 5 * 60_000;

export class PostgresJobApplicationChangeOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly changes: JobApplicationChangePublisher,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.jobApplicationChange],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });

    for (const event of events) {
      try {
        await this.changes.publish(toJobApplicationChange(event.payload));
        await this.outbox.markProcessed(event.id, this.leaseOwner);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const backoffMs = Math.min(
          1_000 * 2 ** Math.max(0, event.attemptCount - 1),
          maximumBackoffMs,
        );
        await this.outbox.markFailed(
          event.id,
          this.leaseOwner,
          message,
          new Date(Date.now() + backoffMs),
        );
      }
    }

    return events.length;
  }
}

function toJobApplicationChange(payload: Record<string, unknown>): JobApplicationChange {
  if (
    (payload.type !== "application.changed" && payload.type !== "application.deleted") ||
    typeof payload.applicationId !== "string" ||
    typeof payload.profileId !== "string" ||
    typeof payload.occurredAt !== "string"
  ) {
    throw new Error("Invalid job application change outbox payload");
  }

  return payload as unknown as JobApplicationChange;
}

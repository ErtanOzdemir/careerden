import type { FileStorage } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 50;
const leaseDurationMs = 30_000;
const maximumBackoffMs = 5 * 60_000;

export class PostgresStorageOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly storage: FileStorage,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.storageDelete],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });

    for (const event of events) {
      try {
        const fileId = event.payload.fileId;
        if (typeof fileId !== "string") throw new Error("Invalid storage deletion payload");
        await this.storage.delete(fileId);
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

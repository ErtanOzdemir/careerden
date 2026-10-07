import type { ApplicationPackGenerationQueue } from "../../domain/job-applications/application-pack-generation.queue.js";
import { outboxEventTypes } from "@careerden/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "@careerden/infrastructure";

const batchSize = 50;
const leaseDurationMs = 30_000;
const maximumBackoffMs = 5 * 60_000;

export class PostgresApplicationPackGenerationOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly queue: ApplicationPackGenerationQueue,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.applicationPackGenerationRequested],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });

    for (const event of events) {
      try {
        const jobApplicationId = event.payload.jobApplicationId;
        const generationAttemptId = event.payload.generationAttemptId;
        if (typeof jobApplicationId !== "string" || typeof generationAttemptId !== "string") {
          throw new Error("Invalid application pack generation outbox payload");
        }
        await this.queue.enqueue({ jobApplicationId, generationAttemptId }, { jobId: event.id });
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

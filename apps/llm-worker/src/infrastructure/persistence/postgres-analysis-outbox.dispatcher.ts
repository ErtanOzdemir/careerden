import type { JobApplicationQueue } from "@careerden/domain";
import { outboxEventTypes } from "@careerden/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "@careerden/infrastructure";

const batchSize = 50;
const leaseDurationMs = 30_000;
const maximumBackoffMs = 5 * 60_000;

export class PostgresAnalysisOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly queue: JobApplicationQueue,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.jobApplicationAnalysisRequested],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });

    for (const event of events) {
      try {
        const jobApplicationId = event.payload.jobApplicationId;
        const analysisAttemptId = event.payload.analysisAttemptId;
        if (typeof jobApplicationId !== "string" || typeof analysisAttemptId !== "string") {
          throw new Error("Invalid analysis request outbox payload");
        }
        await this.queue.enqueue({ jobApplicationId, analysisAttemptId }, { jobId: event.id });
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

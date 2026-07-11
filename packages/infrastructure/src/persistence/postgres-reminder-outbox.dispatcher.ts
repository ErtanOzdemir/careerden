import type {
  FollowUpReminderQueue,
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
} from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 50;
const leaseDurationMs = 30_000;
const maximumBackoffMs = 5 * 60_000;

export class PostgresReminderOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly reminders: FollowUpReminderRepository,
    private readonly queue: FollowUpReminderQueue,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.followUpReminderSchedule, outboxEventTypes.followUpReminderCancel],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });

    for (const event of events) {
      try {
        if (event.type === outboxEventTypes.followUpReminderCancel) {
          const followUpId = requireString(event.payload, "followUpId");
          await this.queue.remove(requireString(event.payload, "jobId"));
          await this.reminders.clearSchedule(followUpId);
        } else {
          const payload = toReminderPayload(event.payload);
          if (await this.reminders.isPendingScheduleCurrent(payload)) {
            const jobId = `follow-up-${payload.followUpId}`;
            await this.queue.remove(jobId);
            const scheduled = await this.queue.enqueue({
              followUpId: payload.followUpId,
              jobApplicationId: payload.jobApplicationId,
              profileId: payload.profileId,
              followUpAt: new Date(payload.followUpAt),
              scheduledFor: new Date(payload.scheduledFor),
            });
            await this.reminders.setSchedule(payload.followUpId, {
              jobId: scheduled.jobId,
              scheduledFor: new Date(payload.scheduledFor),
            });
          }
        }
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

function toReminderPayload(payload: Record<string, unknown>): FollowUpReminderQueuePayload {
  return {
    followUpId: requireString(payload, "followUpId"),
    jobApplicationId: requireString(payload, "jobApplicationId"),
    profileId: requireString(payload, "profileId"),
    followUpAt: requireString(payload, "followUpAt"),
    scheduledFor: requireString(payload, "scheduledFor"),
  };
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string") throw new Error(`Invalid reminder outbox payload: ${key}`);
  return value;
}

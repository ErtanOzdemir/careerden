import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type {
  FollowUpReminderQueue,
  FollowUpReminderQueuePayload,
  ScheduleFollowUpReminderInput,
  ScheduledFollowUpReminder,
} from "@link2cv/domain";

export const followUpReminderQueueName = "follow-up-reminders";

export class BullMqFollowUpReminderQueue implements FollowUpReminderQueue {
  private readonly options: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  };

  constructor(private readonly queue: Queue<FollowUpReminderQueuePayload>) {}

  static create(redisUrl: string): BullMqFollowUpReminderQueue {
    return new BullMqFollowUpReminderQueue(
      new Queue<FollowUpReminderQueuePayload>(followUpReminderQueueName, {
        connection: { url: redisUrl },
      }),
    );
  }

  async enqueue(input: ScheduleFollowUpReminderInput): Promise<ScheduledFollowUpReminder> {
    const scheduledFor = input.scheduledFor;
    const jobId = `follow-up-${input.followUpId}`;
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());

    await this.queue.add(
      "send",
      {
        followUpId: input.followUpId,
        jobApplicationId: input.jobApplicationId,
        profileId: input.profileId,
        followUpAt: input.followUpAt.toISOString(),
        scheduledFor: scheduledFor.toISOString(),
      },
      {
        ...this.options,
        delay,
        jobId,
      },
    );

    return { jobId };
  }

  async remove(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    await job?.remove();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

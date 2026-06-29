import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export const jobApplicationQueueName = "job-applications";

export class BullMqJobApplicationQueue implements JobApplicationQueue {
  private readonly options: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  };

  constructor(private readonly queue: Queue<JobApplicationQueuePayload>) {}

  static create(redisUrl: string): BullMqJobApplicationQueue {
    return new BullMqJobApplicationQueue(
      new Queue<JobApplicationQueuePayload>(jobApplicationQueueName, {
        connection: { url: redisUrl },
      }),
    );
  }

  async enqueue(payload: JobApplicationQueuePayload): Promise<void> {
    const existingJob = await this.queue.getJob(payload.jobApplicationId);
    const existingJobState = await existingJob?.getState();

    await this.queue.add("process", payload, {
      ...this.options,
      jobId:
        existingJobState === "failed"
          ? retryJobId(payload.jobApplicationId)
          : payload.jobApplicationId,
    });
  }

  async restart(payload: JobApplicationQueuePayload): Promise<void> {
    await this.queue.add("process", payload, {
      ...this.options,
      jobId: retryJobId(payload.jobApplicationId),
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

function retryJobId(jobApplicationId: string): string {
  return `${jobApplicationId}-retry-${Date.now()}`;
}

import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type {
  ApplicationPackGenerationQueue,
  ApplicationPackGenerationQueuePayload,
} from "@link2cv/domain";

export const applicationPackGenerationQueueName = "application-pack-generations";

export class BullMqApplicationPackGenerationQueue implements ApplicationPackGenerationQueue {
  private readonly options: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  };

  constructor(private readonly queue: Queue<ApplicationPackGenerationQueuePayload>) {}

  static create(redisUrl: string): BullMqApplicationPackGenerationQueue {
    return new BullMqApplicationPackGenerationQueue(
      new Queue<ApplicationPackGenerationQueuePayload>(applicationPackGenerationQueueName, {
        connection: { url: redisUrl },
      }),
    );
  }

  async enqueue(
    payload: ApplicationPackGenerationQueuePayload,
    options?: { jobId?: string },
  ): Promise<void> {
    const requestedJobId = options?.jobId ?? payload.generationAttemptId;
    const existingJob = await this.queue.getJob(requestedJobId);
    const existingJobState = await existingJob?.getState();

    await this.queue.add("generate", payload, {
      ...this.options,
      jobId: existingJobState === "failed" ? retryJobId(requestedJobId) : requestedJobId,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

function retryJobId(jobId: string): string {
  return `${jobId}-retry-${Date.now()}`;
}

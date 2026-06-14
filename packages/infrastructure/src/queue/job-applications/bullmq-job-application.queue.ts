import { Queue } from "bullmq";
import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export const jobApplicationProcessingQueueName = "job-application-processing";

export class BullMqJobApplicationQueue implements JobApplicationQueue {
  private readonly queue: Queue<JobApplicationQueuePayload>;

  constructor(connection: { host: string; port: number }) {
    this.queue = new Queue<JobApplicationQueuePayload>(jobApplicationProcessingQueueName, {
      connection
    });
  }

  async enqueue(payload: JobApplicationQueuePayload): Promise<void> {
    await this.queue.add("process-job-application", payload, {
      jobId: payload.jobApplicationId,
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }
}

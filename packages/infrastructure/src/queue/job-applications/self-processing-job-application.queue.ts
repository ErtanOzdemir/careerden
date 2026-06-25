import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export type JobProcessor = (payload: JobApplicationQueuePayload) => Promise<void>;

export class SelfProcessingJobApplicationQueue implements JobApplicationQueue {
  private readonly processing = new Set<string>();

  constructor(private readonly processor: JobProcessor) {}

  async enqueue(payload: JobApplicationQueuePayload): Promise<void> {
    void this.process(payload);
  }

  async restart(payload: JobApplicationQueuePayload): Promise<void> {
    void this.process(payload);
  }

  isProcessing(jobApplicationId: string): boolean {
    return this.processing.has(jobApplicationId);
  }

  private async process(payload: JobApplicationQueuePayload): Promise<void> {
    if (this.processing.has(payload.jobApplicationId)) {
      return;
    }

    this.processing.add(payload.jobApplicationId);

    try {
      await this.processor(payload);
    } finally {
      this.processing.delete(payload.jobApplicationId);
    }
  }
}

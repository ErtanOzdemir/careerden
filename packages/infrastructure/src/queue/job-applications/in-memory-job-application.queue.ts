import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export class InMemoryJobApplicationQueue implements JobApplicationQueue {
  readonly jobs: JobApplicationQueuePayload[] = [];

  async enqueue(payload: JobApplicationQueuePayload): Promise<void> {
    this.jobs.push(payload);
  }

  async restart(payload: JobApplicationQueuePayload): Promise<void> {
    const existingIndex = this.jobs.findIndex(
      (job) => job.jobApplicationId === payload.jobApplicationId,
    );

    if (existingIndex >= 0) {
      this.jobs.splice(existingIndex, 1);
    }

    await this.enqueue(payload);
  }
}

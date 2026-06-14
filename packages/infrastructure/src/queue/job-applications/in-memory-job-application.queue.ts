import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export class InMemoryJobApplicationQueue implements JobApplicationQueue {
  readonly jobs: JobApplicationQueuePayload[] = [];

  async enqueue(payload: JobApplicationQueuePayload): Promise<void> {
    this.jobs.push(payload);
  }
}

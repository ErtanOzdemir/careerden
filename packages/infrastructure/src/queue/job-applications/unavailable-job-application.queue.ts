import type { JobApplicationQueue, JobApplicationQueuePayload } from "@link2cv/domain";

export class UnavailableJobApplicationQueue implements JobApplicationQueue {
  constructor(private readonly reason: string) {}

  async enqueue(_payload: JobApplicationQueuePayload): Promise<void> {
    throw new Error(this.reason);
  }

  async restart(_payload: JobApplicationQueuePayload): Promise<void> {
    throw new Error(this.reason);
  }
}

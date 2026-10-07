export interface ApplicationPackGenerationQueuePayload {
  jobApplicationId: string;
  generationAttemptId: string;
}

export interface ApplicationPackGenerationQueue {
  enqueue(
    payload: ApplicationPackGenerationQueuePayload,
    options?: { jobId?: string },
  ): Promise<void>;
}

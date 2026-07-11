export interface JobApplicationQueuePayload {
  jobApplicationId: string;
  analysisAttemptId?: string;
}

export interface JobApplicationQueue {
  enqueue(payload: JobApplicationQueuePayload, options?: { jobId?: string }): Promise<void>;
  restart(payload: JobApplicationQueuePayload): Promise<void>;
}

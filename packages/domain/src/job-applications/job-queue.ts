export interface JobApplicationQueuePayload {
  jobApplicationId: string;
}

export interface JobApplicationQueue {
  enqueue(payload: JobApplicationQueuePayload): Promise<void>;
}

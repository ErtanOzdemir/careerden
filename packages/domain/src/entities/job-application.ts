import type { JobApplicationStatus } from "../workflow-status.js";

export interface JobApplication {
  id: string;
  profileId: string;
  sourceUrl: string;
  status: JobApplicationStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationInput {
  profileId: string;
  sourceUrl: string;
}

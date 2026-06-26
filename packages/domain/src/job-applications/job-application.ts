import type { JobApplicationStatus } from "./workflow-status.js";

export type ApplicationStatus = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

export type ApplicationPriority = "low" | "medium" | "high";

export interface JobApplicationTrackingFields {
  companyName?: string;
  roleTitle?: string;
  roleType?: string;
  jobUrl?: string;
  dateApplied?: string;
  applicationStatus: ApplicationStatus;
  priority: ApplicationPriority;
  tags: string[];
  nextFollowUpAt?: Date;
  lastResponseAt?: Date;
  metadata: Record<string, unknown>;
}

export interface JobApplication {
  id: string;
  profileId: string;
  sourceUrl?: string;
  status: JobApplicationStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  tracking: JobApplicationTrackingFields;
}

export interface CreateJobApplicationInput extends Partial<
  Pick<
    JobApplicationTrackingFields,
    | "companyName"
    | "roleTitle"
    | "roleType"
    | "dateApplied"
    | "applicationStatus"
    | "priority"
    | "tags"
    | "nextFollowUpAt"
    | "lastResponseAt"
    | "metadata"
  >
> {
  profileId: string;
  shouldProcess?: boolean;
  sourceUrl?: string;
  jobUrl?: string;
}

export interface UpdateJobApplicationTrackingInput {
  companyName?: string;
  roleTitle?: string;
  roleType?: string;
  jobUrl?: string;
  dateApplied?: string;
  applicationStatus?: ApplicationStatus;
  priority?: ApplicationPriority;
  tags?: string[];
  nextFollowUpAt?: Date | null;
  lastResponseAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export type JobApplicationEventType =
  | "created"
  | "status_changed"
  | "note"
  | "comment"
  | "reminder"
  | "interview"
  | "processing";

export interface JobApplicationEvent {
  id: string;
  jobApplicationId: string;
  type: JobApplicationEventType;
  title: string;
  body?: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateJobApplicationEventInput {
  jobApplicationId: string;
  type: JobApplicationEventType;
  title: string;
  body?: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface JobApplicationContact {
  id: string;
  jobApplicationId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationContactInput {
  jobApplicationId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  notes?: string;
}

export interface UpdateJobApplicationContactInput {
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedInUrl?: string | null;
  notes?: string | null;
}

export type JobApplicationInterviewStatus = "upcoming" | "completed" | "cancelled";

export interface JobApplicationInterview {
  id: string;
  jobApplicationId: string;
  title: string;
  type?: string;
  scheduledAt: Date;
  status: JobApplicationInterviewStatus;
  notes?: string;
  prepNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationInterviewInput {
  jobApplicationId: string;
  title: string;
  type?: string;
  scheduledAt: Date;
  status?: JobApplicationInterviewStatus;
  notes?: string;
  prepNotes?: string;
}

export interface UpdateJobApplicationInterviewInput {
  title?: string;
  type?: string | null;
  scheduledAt?: Date;
  status?: JobApplicationInterviewStatus;
  notes?: string | null;
  prepNotes?: string | null;
}

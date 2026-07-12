import type { JobApplicationStatus } from "./workflow-status.js";

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted";

export type ApplicationPriority = "low" | "medium" | "high";
export type SalaryPeriod = "hourly" | "monthly" | "yearly";

export interface JobApplicationTrackingFields {
  companyName?: string;
  roleTitle?: string;
  roleType?: string;
  jobUrl?: string;
  dateApplied?: string;
  applicationStatus: ApplicationStatus;
  priority: ApplicationPriority;
  tags: string[];
  lastResponseAt?: Date;
  salaryMinAmount?: number;
  salaryMaxAmount?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  metadata: Record<string, unknown>;
}

export interface JobApplication {
  id: string;
  profileId: string;
  sourceUrl?: string;
  status: JobApplicationStatus;
  failureReason?: string;
  scrapeClaimedBy?: string;
  scrapeClaimExpiresAt?: Date;
  scrapeAttemptCount: number;
  nextScrapeAttemptAt?: Date;
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
    | "lastResponseAt"
    | "salaryMinAmount"
    | "salaryMaxAmount"
    | "salaryCurrency"
    | "salaryPeriod"
    | "metadata"
  >
> {
  profileId: string;
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
  lastResponseAt?: Date | null;
  salaryMinAmount?: number | null;
  salaryMaxAmount?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | null;
  metadata?: Record<string, unknown>;
}

export type JobApplicationEventType =
  | "created"
  | "status_changed"
  | "note"
  | "comment"
  | "reminder"
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

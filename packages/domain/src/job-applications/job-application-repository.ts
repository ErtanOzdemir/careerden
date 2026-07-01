import type {
  GeneratedDocument,
  GeneratedDocumentFormat,
  GeneratedDocumentKind,
} from "../documents/generated-document.js";
import type { DocumentContent } from "../documents/rich-document.js";
import type { MatchAnalysisResult } from "../matching/match-analysis.js";
import type { ScrapeBundle } from "../scraping/scraped-data.js";
import type {
  ApplicationPriority,
  ApplicationStatus,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationInterviewInput,
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationInterviewInput,
  UpdateJobApplicationTrackingInput,
} from "./job-application.js";
import type { JobApplicationStatus } from "./workflow-status.js";

export interface AttachGeneratedDocumentInput {
  jobApplicationId: string;
  kind: GeneratedDocumentKind;
  format: GeneratedDocumentFormat;
  fileId: string;
  fileName: string;
  contentType: string;
}

export type JobApplicationSortField =
  | "dateApplied"
  | "companyName"
  | "roleTitle"
  | "applicationStatus"
  | "updatedAt";

export interface ListJobApplicationsFilter {
  applicationStatus?: ApplicationStatus;
  processingStatus?: JobApplicationStatus;
  company?: string;
  role?: string;
  roleType?: string;
  priority?: ApplicationPriority;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: JobApplicationSortField;
  sortDirection?: "asc" | "desc";
}

export interface ClaimNextScrapeJobInput {
  profileId: string;
  claimedBy: string;
  claimDurationMs: number;
  now?: Date;
}

export interface RenewScrapeClaimInput {
  claimedBy: string;
  claimDurationMs: number;
  now?: Date;
}

export interface RecordScrapeFailureInput {
  claimedBy: string;
  reason: string;
  maxAttempts: number;
  backoffMs: number;
  now?: Date;
}

export interface JobApplicationRepository {
  create(input: CreateJobApplicationInput): Promise<JobApplication>;
  claimNextScrapeJob(input: ClaimNextScrapeJobInput): Promise<JobApplication | null>;
  renewScrapeClaim(id: string, input: RenewScrapeClaimInput): Promise<JobApplication | null>;
  recordScrapeFailure(id: string, input: RecordScrapeFailureInput): Promise<JobApplication | null>;
  deleteById(id: string): Promise<void>;
  findById(id: string): Promise<JobApplication | null>;
  listByProfileId(profileId: string, filter?: ListJobApplicationsFilter): Promise<JobApplication[]>;
  listByStatus(status: JobApplicationStatus): Promise<JobApplication[]>;
  resetProcessing(id: string): Promise<JobApplication>;
  updateStatus(id: string, status: JobApplicationStatus, failureReason?: string): Promise<void>;
  updateTracking(id: string, input: UpdateJobApplicationTrackingInput): Promise<JobApplication>;
  saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void>;
  getScrapeBundle(id: string): Promise<ScrapeBundle | null>;
  getCompanyLogoFileId(id: string): Promise<string | null>;
  saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void>;
  getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null>;
  saveDocumentContent(id: string, content: DocumentContent): Promise<void>;
  getDocumentContent(id: string): Promise<DocumentContent | null>;
  addEvent(input: CreateJobApplicationEventInput): Promise<JobApplicationEvent>;
  listEvents(jobApplicationId: string): Promise<JobApplicationEvent[]>;
  createContact(input: CreateJobApplicationContactInput): Promise<JobApplicationContact>;
  findContactById(id: string): Promise<JobApplicationContact | null>;
  listContacts(jobApplicationId: string): Promise<JobApplicationContact[]>;
  updateContact(
    id: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact>;
  deleteContact(id: string): Promise<void>;
  createInterview(input: CreateJobApplicationInterviewInput): Promise<JobApplicationInterview>;
  findInterviewById(id: string): Promise<JobApplicationInterview | null>;
  listInterviews(jobApplicationId: string): Promise<JobApplicationInterview[]>;
  updateInterview(
    id: string,
    input: UpdateJobApplicationInterviewInput,
  ): Promise<JobApplicationInterview>;
  deleteInterview(id: string): Promise<void>;
  attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument>;
  listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]>;
}

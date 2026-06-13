import type { GeneratedDocument, GeneratedDocumentKind } from "../entities/generated-document.js";
import type { JobApplication, CreateJobApplicationInput } from "../entities/job-application.js";
import type { MatchAnalysisResult } from "../entities/match-analysis.js";
import type { ScrapeBundle } from "../entities/scraped-data.js";
import type { JobApplicationStatus } from "../workflow-status.js";

export interface AttachGeneratedDocumentInput {
  jobApplicationId: string;
  kind: GeneratedDocumentKind;
  fileId: string;
  fileName: string;
  contentType: "application/pdf";
}

export interface JobApplicationRepository {
  create(input: CreateJobApplicationInput): Promise<JobApplication>;
  findById(id: string): Promise<JobApplication | null>;
  listByProfileId(profileId: string): Promise<JobApplication[]>;
  listByStatus(status: JobApplicationStatus): Promise<JobApplication[]>;
  updateStatus(id: string, status: JobApplicationStatus, failureReason?: string): Promise<void>;
  saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void>;
  getScrapeBundle(id: string): Promise<ScrapeBundle | null>;
  saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void>;
  getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null>;
  attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument>;
  listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]>;
}

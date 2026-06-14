import type {
  AttachGeneratedDocumentInput,
  GeneratedDocument,
  JobApplication,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle
} from "@link2cv/domain";
import type { CreateJobApplicationInput } from "@link2cv/domain";
import type { JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryJobApplicationRepository implements JobApplicationRepository {
  private readonly jobApplications = new Map<string, JobApplication>();
  private readonly scrapeBundles = new Map<string, ScrapeBundle>();
  private readonly matchAnalyses = new Map<string, MatchAnalysisResult>();
  private readonly documents = new Map<string, GeneratedDocument[]>();

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const now = new Date();
    const jobApplication: JobApplication = {
      id: randomUUID(),
      profileId: input.profileId,
      sourceUrl: input.sourceUrl,
      status: "queued",
      createdAt: now,
      updatedAt: now
    };

    this.jobApplications.set(jobApplication.id, jobApplication);
    return jobApplication;
  }

  async findById(id: string): Promise<JobApplication | null> {
    return this.jobApplications.get(id) ?? null;
  }

  async listByProfileId(profileId: string): Promise<JobApplication[]> {
    return [...this.jobApplications.values()].filter((job) => job.profileId === profileId);
  }

  async listByStatus(status: JobApplicationStatus): Promise<JobApplication[]> {
    return [...this.jobApplications.values()].filter((job) => job.status === status);
  }

  async updateStatus(
    id: string,
    status: JobApplicationStatus,
    failureReason?: string
  ): Promise<void> {
    const existing = this.jobApplications.get(id);

    if (!existing) {
      throw new Error(`Job application ${id} was not found`);
    }

    this.jobApplications.set(id, {
      ...existing,
      status,
      failureReason,
      updatedAt: new Date()
    });
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void> {
    this.scrapeBundles.set(id, scrape);
  }

  async getScrapeBundle(id: string): Promise<ScrapeBundle | null> {
    return this.scrapeBundles.get(id) ?? null;
  }

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void> {
    this.matchAnalyses.set(id, result);
  }

  async getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null> {
    return this.matchAnalyses.get(id) ?? null;
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const document: GeneratedDocument = {
      id: randomUUID(),
      ...input,
      createdAt: new Date()
    };
    const current = this.documents.get(input.jobApplicationId) ?? [];

    this.documents.set(input.jobApplicationId, [...current, document]);
    return document;
  }

  async listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]> {
    return this.documents.get(jobApplicationId) ?? [];
  }
}

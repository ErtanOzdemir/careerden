import { randomUUID } from "node:crypto";
import type {
  ApplicationPriority,
  ApplicationStatus,
  ApplicationPackPreferences,
  FileStorage,
  JobApplication,
  PersistenceUnitOfWork,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { assessProfileReadiness } from "@careerden/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";
import type { AiAvailability } from "../../domain/matching/ai-availability.js";

export interface ManualCompanyLogo {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  fileName: string;
}

export interface CreateManualJobApplicationInput {
  applicationStatus?: ApplicationStatus;
  applicationPackPreferences?: ApplicationPackPreferences;
  companyDescription?: string;
  companyLogo?: ManualCompanyLogo;
  companyName: string;
  companyWebsiteUrl?: string;
  dateApplied?: string;
  jobDescription: string;
  jobLocation?: string;
  jobUrl?: string;
  lastResponseAt?: Date;
  metadata?: Record<string, unknown>;
  priority?: ApplicationPriority;
  profileId: string;
  roleType?: string;
  roleTitle: string;
  tags?: string[];
}

export class CreateManualJobApplicationUseCase {
  constructor(
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly aiAvailability?: AiAvailability,
  ) {}

  async execute(input: CreateManualJobApplicationInput, userId: string): Promise<JobApplication> {
    await getAccessibleProfile(this.profiles, input.profileId, userId);

    const manualEntryId = randomUUID();
    const submittedAt = new Date().toISOString();
    const storedLogo = input.companyLogo
      ? await this.storage.put({
          key: `job-applications/manual-intake/${manualEntryId}/company-logo/${safeFileName(
            input.companyLogo.fileName,
          )}`,
          fileName: input.companyLogo.fileName,
          contentType: input.companyLogo.contentType,
          body: input.companyLogo.body,
          metadata: {
            kind: "company_logo",
            profileId: input.profileId,
            source: "manual-job-application",
          },
        })
      : undefined;

    try {
      return await this.unitOfWork.execute(
        async ({ credits, jobApplications, jobApplicationChanges, outbox, profiles }) => {
          const profile = await getAccessibleProfile(profiles, input.profileId, userId);
          const jobApplication = await jobApplications.create({
            profileId: input.profileId,
            applicationPackPreferences: input.applicationPackPreferences,
            companyName: input.companyName,
            roleTitle: input.roleTitle,
            ...(input.jobLocation || input.roleType
              ? { roleType: input.jobLocation ?? input.roleType }
              : {}),
            ...(input.jobUrl ? { jobUrl: input.jobUrl } : {}),
            ...(input.dateApplied ? { dateApplied: input.dateApplied } : {}),
            ...(input.applicationStatus ? { applicationStatus: input.applicationStatus } : {}),
            ...(input.priority ? { priority: input.priority } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
            ...(input.lastResponseAt ? { lastResponseAt: input.lastResponseAt } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          });
          const scrapeBundle = createManualScrapeBundle(input, {
            manualEntryId,
            submittedAt,
            logoFileId: storedLogo?.id,
          });

          await jobApplications.saveScrapeBundle(jobApplication.id, scrapeBundle);
          await jobApplications.updateStatus(jobApplication.id, "scraped");
          await jobApplications.addEvent({
            jobApplicationId: jobApplication.id,
            type: "processing",
            title: "Manual job details saved",
            metadata: { strategy: "manual" },
          });
          await enqueueMatchAnalysisIfEnabled({
            credits,
            jobApplications,
            outbox,
            userId,
            jobApplicationId: jobApplication.id,
            autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
            profileReadiness: assessProfileReadiness(profile),
            insufficientCreditBehavior: "skip",
            aiAvailability: this.aiAvailability,
          });
          await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);

          return (
            (await jobApplications.findById(jobApplication.id)) ?? {
              ...jobApplication,
              status: "scraped",
            }
          );
        },
      );
    } catch (error) {
      if (storedLogo) {
        await this.storage.delete(storedLogo.id).catch(() => undefined);
      }
      throw error;
    }
  }
}

function createManualScrapeBundle(
  input: CreateManualJobApplicationInput,
  metadata: { logoFileId?: string; manualEntryId: string; submittedAt: string },
): ScrapeBundle {
  const raw = {
    adapter: "manual-job",
    strategy: "manual",
    source: "user-created-job-application",
    manualEntryId: metadata.manualEntryId,
    submittedAt: metadata.submittedAt,
    ...(input.jobUrl ? { jobUrl: input.jobUrl } : {}),
  };

  return {
    job: {
      title: input.roleTitle,
      companyName: input.companyName,
      ...(input.jobLocation ? { location: input.jobLocation } : {}),
      description: input.jobDescription,
      requirements: [],
      raw,
    },
    companyManual: {
      name: input.companyName,
      ...(input.companyDescription ? { description: input.companyDescription } : {}),
      ...(input.companyWebsiteUrl ? { websiteUrl: input.companyWebsiteUrl } : {}),
      ...(metadata.logoFileId ? { logoFileId: metadata.logoFileId } : {}),
      raw: {
        adapter: "manual-company",
        strategy: "manual",
        source: "user-created-job-application",
        manualEntryId: metadata.manualEntryId,
        submittedAt: metadata.submittedAt,
      },
    },
  };
}

function safeFileName(fileName: string): string {
  return fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "-") || "company-logo";
}

import type {
  FileStorage,
  JobApplication,
  JobApplicationQueue,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export type JobApplicationRetryMode = "analysis" | "scraping";

export interface RetryJobApplicationResult {
  jobApplication: JobApplication;
  mode: JobApplicationRetryMode;
}

export interface RetryJobApplicationOptions {
  mode?: "auto" | "scraping";
}

export class RetryJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
    private readonly queue: JobApplicationQueue,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    options: RetryJobApplicationOptions = {},
  ): Promise<RetryJobApplicationResult> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

    if (jobApplication.status !== "failed") {
      throw new ApplicationError("validation", "Only failed job applications can be retried");
    }

    const scrape = await this.jobApplications.getScrapeBundle(jobApplicationId);
    const mode: JobApplicationRetryMode =
      options.mode === "scraping" || !scrape ? "scraping" : "analysis";

    if (mode === "scraping" && !jobApplication.sourceUrl) {
      throw new ApplicationError(
        "validation",
        "Job application does not have a source URL to retry",
      );
    }

    const [documents, companyLogoFileId] = await Promise.all([
      this.jobApplications.listGeneratedDocuments(jobApplicationId),
      mode === "scraping"
        ? this.jobApplications.getCompanyLogoFileId(jobApplicationId)
        : Promise.resolve(null),
    ]);
    const fileIds = new Set(documents.map((document) => document.fileId));

    if (companyLogoFileId) {
      fileIds.add(companyLogoFileId);
    }

    const reset =
      mode === "analysis"
        ? await this.jobApplications.resetAnalysis(jobApplicationId)
        : await this.jobApplications.resetProcessing(jobApplicationId);
    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: mode === "analysis" ? "AI analysis retry requested" : "Retry requested",
    });
    await Promise.allSettled([...fileIds].map((fileId) => this.storage.delete(fileId)));

    if (mode === "analysis") {
      await this.queue.restart({ jobApplicationId });
    }

    return {
      jobApplication: reset,
      mode,
    };
  }
}

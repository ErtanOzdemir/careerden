import type { FileStorage, JobApplication, JobApplicationRepository } from "@link2cv/domain";

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
    private readonly storage: FileStorage,
  ) {}

  async execute(
    jobApplicationId: string,
    options: RetryJobApplicationOptions = {},
  ): Promise<RetryJobApplicationResult | null> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      return null;
    }

    if (jobApplication.status !== "failed") {
      throw new Error("Only failed job applications can be retried");
    }

    const scrape = await this.jobApplications.getScrapeBundle(jobApplicationId);
    const mode: JobApplicationRetryMode =
      options.mode === "scraping" || !scrape ? "scraping" : "analysis";

    if (mode === "scraping" && !jobApplication.sourceUrl) {
      throw new Error("Job application does not have a source URL to retry");
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

    return {
      jobApplication: reset,
      mode,
    };
  }
}

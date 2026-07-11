import type { JobApplication, PersistenceUnitOfWork } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";

export type JobApplicationRetryMode = "analysis" | "scraping";

export interface RetryJobApplicationResult {
  jobApplication: JobApplication;
  mode: JobApplicationRetryMode;
}

export interface RetryJobApplicationOptions {
  mode?: "auto" | "scraping";
}

export class RetryJobApplicationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    options: RetryJobApplicationOptions = {},
  ): Promise<RetryJobApplicationResult> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );

      if (jobApplication.status !== "failed") {
        throw new ApplicationError("validation", "Only failed job applications can be retried");
      }

      const scrape = await jobApplications.getScrapeBundle(jobApplicationId);
      const mode: JobApplicationRetryMode =
        options.mode === "scraping" || !scrape ? "scraping" : "analysis";

      if (mode === "scraping" && !jobApplication.sourceUrl) {
        throw new ApplicationError(
          "validation",
          "Job application does not have a source URL to retry",
        );
      }

      const [documents, companyLogoFileId] = await Promise.all([
        jobApplications.listGeneratedDocuments(jobApplicationId),
        mode === "scraping"
          ? jobApplications.getCompanyLogoFileId(jobApplicationId)
          : Promise.resolve(null),
      ]);
      const fileIds = new Set(documents.map((document) => document.fileId));

      if (companyLogoFileId) fileIds.add(companyLogoFileId);

      const reset =
        mode === "analysis"
          ? await jobApplications.resetAnalysis(jobApplicationId)
          : await jobApplications.resetProcessing(jobApplicationId);
      await jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: mode === "analysis" ? "AI analysis retry requested" : "Retry requested",
      });
      await enqueueStorageDeletions(outbox, fileIds);

      if (mode === "analysis") {
        await enqueueMatchAnalysisIfEnabled({
          jobApplications,
          outbox,
          jobApplicationId,
          autoRunMatchAnalysis: true,
        });
      }

      await enqueueJobApplicationChange(outbox, reset.id, reset.profileId);

      return {
        jobApplication: reset,
        mode,
      };
    });
  }
}

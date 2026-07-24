import type { JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import { assessProfileReadiness } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
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
    return this.unitOfWork.execute(
      async ({ credits, jobApplications, jobApplicationChanges, outbox, profiles }) => {
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

        await credits.releaseReservationsForResource(
          "match_analysis",
          "job_application",
          jobApplicationId,
          "superseded",
          new Date(),
        );
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
          const profile = await profiles.findById(reset.profileId);
          if (!profile) throw new ApplicationError("not_found", "Profile not found");
          await enqueueMatchAnalysisIfEnabled({
            credits,
            jobApplications,
            outbox,
            userId,
            jobApplicationId,
            autoRunMatchAnalysis: true,
            profileReadiness: assessProfileReadiness(profile),
            insufficientCreditBehavior: "throw",
          });
        }

        await jobApplicationChanges.changed(reset.id, reset.profileId);

        return {
          jobApplication: reset,
          mode,
        };
      },
    );
  }
}

import type { JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import { assessProfileReadiness } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { enqueueStorageDeletions } from "@careerden/application";
import { enqueueApplicationPackGeneration } from "@careerden/application";
import { getActiveAccessibleJobApplication } from "@careerden/application";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";

export type JobApplicationRetryMode = "analysis" | "documents" | "scraping";

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
        const jobApplication = await getActiveAccessibleJobApplication(
          jobApplications,
          profiles,
          jobApplicationId,
          userId,
        );

        if (jobApplication.status !== "failed") {
          throw new ApplicationError("validation", "Only failed job applications can be retried");
        }

        const scrape = await jobApplications.getScrapeBundle(jobApplicationId);
        const matchAnalysis =
          options.mode === "scraping" || !scrape
            ? null
            : await jobApplications.getMatchAnalysis(jobApplicationId);
        const mode: JobApplicationRetryMode =
          options.mode === "scraping" || !scrape
            ? "scraping"
            : matchAnalysis
              ? "documents"
              : "analysis";

        if (mode === "scraping" && !jobApplication.sourceUrl) {
          throw new ApplicationError(
            "validation",
            "Job application does not have a source URL to retry",
          );
        }

        if (mode === "documents") {
          const generationAttemptId = await enqueueApplicationPackGeneration({
            jobApplications,
            outbox,
            jobApplication,
          });
          if (!generationAttemptId) {
            throw new ApplicationError(
              "validation",
              "Application pack generation is not available in the current processing state",
            );
          }
          const retried = await jobApplications.findById(jobApplicationId);
          if (!retried) throw new ApplicationError("not_found", "Job application not found");

          await jobApplicationChanges.changed(retried.id, retried.profileId);
          return {
            jobApplication: retried,
            mode,
          };
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

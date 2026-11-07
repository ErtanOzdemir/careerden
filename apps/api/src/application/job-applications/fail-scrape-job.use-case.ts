import type { ScrapingFailureCategory } from "@careerden/contracts";
import type { PersistenceUnitOfWork } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getActiveAccessibleJobApplication } from "@careerden/application";
import {
  scrapeRetryBackoffMs,
  scrapeRetryPolicyFor,
} from "../../domain/scraping/scrape-retry-policy.js";

export type FailScrapeJobResult = "failed" | "retry_scheduled";

export class FailScrapeJobUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { claimedBy: string; reason: string; category?: ScrapingFailureCategory },
    now = new Date(),
  ): Promise<FailScrapeJobResult> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== input.claimedBy) {
        throw new ApplicationError(
          "conflict",
          "Job application scrape claim is owned by another desktop client",
        );
      }

      const retryPolicy = scrapeRetryPolicyFor(input.category);
      const updated = await jobApplications.recordScrapeFailure(jobApplicationId, {
        claimedBy: input.claimedBy,
        reason: input.reason,
        ...(input.category ? { category: input.category } : {}),
        maxAttempts: retryPolicy.maxAttempts,
        backoffMs: scrapeRetryBackoffMs(retryPolicy, jobApplication.scrapeAttemptCount),
        now,
      });
      if (!updated) throw new ApplicationError("not_found", "Job application not found");

      await jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: updated.status === "failed" ? "Scraping failed" : "Scraping retry scheduled",
        body: input.reason,
        metadata: {
          ...(input.category ? { scrapeFailureCategory: input.category } : {}),
          attempt: updated.scrapeAttemptCount,
          maxAttempts: retryPolicy.maxAttempts,
          ...(updated.status !== "failed" && updated.nextScrapeAttemptAt
            ? { nextAttemptAt: updated.nextScrapeAttemptAt.toISOString() }
            : {}),
        },
      });
      await jobApplicationChanges.changed(updated.id, updated.profileId);
      return updated.status === "failed" ? "failed" : "retry_scheduled";
    });
  }
}

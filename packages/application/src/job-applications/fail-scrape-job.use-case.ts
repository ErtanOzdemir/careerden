import type { PersistenceUnitOfWork } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

const maxScrapeAttempts = 3;
const scrapeRetryBackoffMs = [60_000, 300_000];

export type FailScrapeJobResult = "failed" | "retry_scheduled";

export class FailScrapeJobUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { claimedBy: string; reason: string },
    now = new Date(),
  ): Promise<FailScrapeJobResult> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
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

      const updated = await jobApplications.recordScrapeFailure(jobApplicationId, {
        claimedBy: input.claimedBy,
        reason: input.reason,
        maxAttempts: maxScrapeAttempts,
        backoffMs: scrapeRetryBackoffMs[jobApplication.scrapeAttemptCount - 1] ?? 0,
        now,
      });
      if (!updated) throw new ApplicationError("not_found", "Job application not found");

      await jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: updated.status === "failed" ? "Scraping failed" : "Scraping retry scheduled",
        body: input.reason,
        metadata: {
          attempt: updated.scrapeAttemptCount,
          maxAttempts: maxScrapeAttempts,
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

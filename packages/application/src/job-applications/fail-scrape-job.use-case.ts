import type { JobApplicationRepository, UserProfileAccessRepository } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

const maxScrapeAttempts = 3;
const scrapeRetryBackoffMs = [60_000, 300_000];

export type FailScrapeJobResult = "failed" | "retry_scheduled";

export class FailScrapeJobUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { claimedBy: string; reason: string },
    now = new Date(),
  ): Promise<FailScrapeJobResult> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== input.claimedBy) {
      throw new ApplicationError(
        "conflict",
        "Job application scrape claim is owned by another desktop client",
      );
    }

    const updated = await this.jobApplications.recordScrapeFailure(jobApplicationId, {
      claimedBy: input.claimedBy,
      reason: input.reason,
      maxAttempts: maxScrapeAttempts,
      backoffMs: scrapeRetryBackoffMs[jobApplication.scrapeAttemptCount - 1] ?? 0,
      now,
    });
    if (!updated) throw new ApplicationError("not_found", "Job application not found");

    if (updated.status === "failed") {
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping failed",
        body: input.reason,
        metadata: { attempt: updated.scrapeAttemptCount, maxAttempts: maxScrapeAttempts },
      });
      await this.changes.changed(updated.id, updated.profileId);
      return "failed";
    }

    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "Scraping retry scheduled",
      body: input.reason,
      metadata: {
        attempt: updated.scrapeAttemptCount,
        maxAttempts: maxScrapeAttempts,
        ...(updated.nextScrapeAttemptAt
          ? { nextAttemptAt: updated.nextScrapeAttemptAt.toISOString() }
          : {}),
      },
    });
    await this.changes.changed(updated.id, updated.profileId);
    return "retry_scheduled";
  }
}

import type { JobApplication, PersistenceUnitOfWork } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

const scrapeClaimDurationMs = 600_000;

export class RenewScrapeClaimUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    claimedBy: string,
  ): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      await getAccessibleJobApplication(jobApplications, profiles, jobApplicationId, userId);
      const renewed = await jobApplications.renewScrapeClaim(jobApplicationId, {
        claimedBy,
        claimDurationMs: scrapeClaimDurationMs,
      });
      if (!renewed) throw new ApplicationError("not_found", "Job application not found");
      await enqueueJobApplicationChange(outbox, renewed.id, renewed.profileId);
      return renewed;
    });
  }
}

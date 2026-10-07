import type { JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getActiveAccessibleJobApplication } from "@careerden/application";

const scrapeClaimDurationMs = 600_000;

export class RenewScrapeClaimUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    claimedBy: string,
  ): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      await getActiveAccessibleJobApplication(jobApplications, profiles, jobApplicationId, userId);
      const renewed = await jobApplications.renewScrapeClaim(jobApplicationId, {
        claimedBy,
        claimDurationMs: scrapeClaimDurationMs,
      });
      if (!renewed) throw new ApplicationError("not_found", "Job application not found");
      await jobApplicationChanges.changed(renewed.id, renewed.profileId);
      return renewed;
    });
  }
}

import type {
  JobApplication,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

const scrapeClaimDurationMs = 600_000;

export class RenewScrapeClaimUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    claimedBy: string,
  ): Promise<JobApplication> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const renewed = await this.jobApplications.renewScrapeClaim(jobApplicationId, {
      claimedBy,
      claimDurationMs: scrapeClaimDurationMs,
    });
    if (!renewed) throw new ApplicationError("not_found", "Job application not found");
    await this.changes.changed(renewed.id, renewed.profileId);
    return renewed;
  }
}

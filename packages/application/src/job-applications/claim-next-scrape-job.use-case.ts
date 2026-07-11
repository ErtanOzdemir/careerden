import type { JobApplication, JobApplicationRepository } from "@link2cv/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

const scrapeClaimDurationMs = 600_000;

export class ClaimNextScrapeJobUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(user: AuthenticatedProfileUser, claimedBy: string): Promise<JobApplication | null> {
    const profile = await this.getCurrentProfile.execute(user);
    const claimed = await this.jobApplications.claimNextScrapeJob({
      profileId: profile.id,
      claimedBy,
      claimDurationMs: scrapeClaimDurationMs,
    });

    if (claimed) {
      await this.jobApplications.addEvent({
        jobApplicationId: claimed.id,
        type: "processing",
        title: "Scraping started",
      });
      await this.changes.changed(claimed.id, claimed.profileId);
    }

    return claimed;
  }
}

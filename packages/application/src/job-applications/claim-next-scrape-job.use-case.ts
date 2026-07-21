import type { JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";

const scrapeClaimDurationMs = 600_000;

export class ClaimNextScrapeJobUseCase {
  constructor(
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(user: AuthenticatedProfileUser, claimedBy: string): Promise<JobApplication | null> {
    const profile = await this.getCurrentProfile.execute(user);
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges }) => {
      const claimed = await jobApplications.claimNextScrapeJob({
        profileId: profile.id,
        claimedBy,
        claimDurationMs: scrapeClaimDurationMs,
      });

      if (claimed) {
        await jobApplications.addEvent({
          jobApplicationId: claimed.id,
          type: "processing",
          title: "Scraping started",
        });
        await jobApplicationChanges.changed(claimed.id, claimed.profileId);
      }

      return claimed;
    });
  }
}

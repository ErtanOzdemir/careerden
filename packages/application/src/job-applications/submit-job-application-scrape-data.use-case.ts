import type {
  FileStorage,
  JobApplicationRepository,
  PersistenceUnitOfWork,
  RemoteImageFetcher,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";
import type { GetJobApplicationDetailUseCase } from "./get-job-application-detail.use-case.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";
import type { JobApplicationDetail } from "./job-application-read-model.js";
import { storeCompanyLogo } from "./store-company-logo.js";

export class SubmitJobApplicationScrapeDataUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly remoteImages: RemoteImageFetcher,
    private readonly storage: FileStorage,
    private readonly getJobApplicationDetail: Pick<GetJobApplicationDetailUseCase, "execute">,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { claimedBy: string; scrapeBundle: ScrapeBundle },
  ): Promise<JobApplicationDetail> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

    assertScrapeSubmissionAllowed(jobApplication, input.claimedBy);

    const scrape = await storeCompanyLogo({
      jobApplicationId,
      scrape: input.scrapeBundle,
      remoteImages: this.remoteImages,
      storage: this.storage,
    });
    await this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const current = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      assertScrapeSubmissionAllowed(current, input.claimedBy);
      await jobApplications.saveScrapeBundle(jobApplicationId, scrape);
      await jobApplications.updateTracking(jobApplicationId, {
        companyName: scrape.job.companyName,
        roleTitle: scrape.job.title,
      });
      await jobApplications.updateStatus(jobApplicationId, "scraped");
      await jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping complete",
        metadata: { companyName: scrape.job.companyName, roleTitle: scrape.job.title },
      });

      const profile = await profiles.findById(current.profileId);
      if (!profile) throw new ApplicationError("not_found", "Profile not found");
      await enqueueMatchAnalysisIfEnabled({
        jobApplications,
        outbox,
        jobApplicationId,
        autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
      });
      await enqueueJobApplicationChange(outbox, current.id, current.profileId);
    });

    return this.getJobApplicationDetail.execute(jobApplicationId, userId);
  }
}

function assertScrapeSubmissionAllowed(
  jobApplication: Awaited<ReturnType<typeof getAccessibleJobApplication>>,
  claimedBy: string,
): void {
  if (!canTransitionJobApplicationStatus(jobApplication.status, "scraped")) {
    throw new ApplicationError("validation", "Invalid status transition");
  }
  if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== claimedBy) {
    throw new ApplicationError("conflict", "Scrape claim is owned by another desktop client");
  }
}

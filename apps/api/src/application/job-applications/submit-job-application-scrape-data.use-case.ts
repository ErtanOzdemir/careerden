import type {
  FileStorage,
  JobApplicationRepository,
  PersistenceUnitOfWork,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@careerden/domain";
import type { RemoteImageFetcher } from "../../domain/scraping/remote-image-fetcher.js";
import { assessProfileReadiness, canTransitionJobApplicationStatus } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { enqueueStorageDeletions } from "@careerden/application";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";
import type { AiAvailability } from "../../domain/matching/ai-availability.js";
import type { GetJobApplicationDetailUseCase } from "./get-job-application-detail.use-case.js";
import { getActiveAccessibleJobApplication } from "@careerden/application";
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
    private readonly aiAvailability?: AiAvailability,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { claimedBy: string; scrapeBundle: ScrapeBundle },
  ): Promise<JobApplicationDetail> {
    const jobApplication = await getActiveAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

    assertScrapeSubmissionAllowed(jobApplication, input.claimedBy);

    const previousLogoFileId = await this.jobApplications.getCompanyLogoFileId(jobApplicationId);
    const logo = await storeCompanyLogo({
      jobApplicationId,
      scrape: input.scrapeBundle,
      remoteImages: this.remoteImages,
      storage: this.storage,
    });
    try {
      await this.unitOfWork.execute(
        async ({ credits, jobApplications, jobApplicationChanges, outbox, profiles }) => {
          const current = await getActiveAccessibleJobApplication(
            jobApplications,
            profiles,
            jobApplicationId,
            userId,
          );
          assertScrapeSubmissionAllowed(current, input.claimedBy);
          await jobApplications.saveScrapeBundle(jobApplicationId, logo.scrape);
          await jobApplications.updateTracking(jobApplicationId, {
            companyName: logo.scrape.job.companyName,
            roleTitle: logo.scrape.job.title,
            ...(logo.scrape.job.location ? { roleType: logo.scrape.job.location } : {}),
          });
          await jobApplications.updateStatus(jobApplicationId, "scraped");
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "Scraping complete",
            metadata: {
              companyName: logo.scrape.job.companyName,
              roleTitle: logo.scrape.job.title,
            },
          });

          const profile = await profiles.findById(current.profileId);
          if (!profile) throw new ApplicationError("not_found", "Profile not found");
          await enqueueMatchAnalysisIfEnabled({
            credits,
            jobApplications,
            outbox,
            userId,
            jobApplicationId,
            autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
            profileReadiness: assessProfileReadiness(profile),
            insufficientCreditBehavior: "skip",
            aiAvailability: this.aiAvailability,
          });
          if (previousLogoFileId && previousLogoFileId !== logo.uploadedFileId) {
            await enqueueStorageDeletions(outbox, [previousLogoFileId]);
          }
          await jobApplicationChanges.changed(current.id, current.profileId);
        },
      );
    } catch (error) {
      const uploadedFileId = logo.uploadedFileId;
      if (uploadedFileId && uploadedFileId !== previousLogoFileId) {
        await this.unitOfWork.execute(({ outbox }) =>
          enqueueStorageDeletions(outbox, [uploadedFileId]),
        );
      }
      throw error;
    }

    return this.getJobApplicationDetail.execute(jobApplicationId, userId);
  }
}

function assertScrapeSubmissionAllowed(
  jobApplication: Awaited<ReturnType<typeof getActiveAccessibleJobApplication>>,
  claimedBy: string,
): void {
  if (!canTransitionJobApplicationStatus(jobApplication.status, "scraped")) {
    throw new ApplicationError("validation", "Invalid status transition");
  }
  if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== claimedBy) {
    throw new ApplicationError("conflict", "Scrape claim is owned by another desktop client");
  }
}

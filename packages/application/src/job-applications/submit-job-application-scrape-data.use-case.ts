import type {
  FileStorage,
  JobApplicationQueue,
  JobApplicationRepository,
  RemoteImageFetcher,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";
import type { GetJobApplicationDetailUseCase } from "./get-job-application-detail.use-case.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";
import type { JobApplicationDetail } from "./job-application-read-model.js";
import { storeCompanyLogo } from "./store-company-logo.js";

export class SubmitJobApplicationScrapeDataUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly queue: JobApplicationQueue,
    private readonly remoteImages: RemoteImageFetcher,
    private readonly storage: FileStorage,
    private readonly getJobApplicationDetail: Pick<GetJobApplicationDetailUseCase, "execute">,
    private readonly changes: JobApplicationChangeNotifier,
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

    if (!canTransitionJobApplicationStatus(jobApplication.status, "scraped")) {
      throw new ApplicationError("validation", "Invalid status transition");
    }
    if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== input.claimedBy) {
      throw new ApplicationError("conflict", "Scrape claim is owned by another desktop client");
    }

    const scrape = input.scrapeBundle;
    await this.jobApplications.saveScrapeBundle(jobApplicationId, scrape);
    await storeCompanyLogo({
      jobApplicationId,
      scrape,
      remoteImages: this.remoteImages,
      storage: this.storage,
      jobApplications: this.jobApplications,
    });
    await this.jobApplications.updateTracking(jobApplicationId, {
      companyName: scrape.job.companyName,
      roleTitle: scrape.job.title,
    });
    await this.jobApplications.updateStatus(jobApplicationId, "scraped");
    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "Scraping complete",
      metadata: { companyName: scrape.job.companyName, roleTitle: scrape.job.title },
    });

    const profile = await this.profiles.findById(jobApplication.profileId);
    if (!profile) throw new ApplicationError("not_found", "Profile not found");
    await enqueueMatchAnalysisIfEnabled({
      jobApplications: this.jobApplications,
      queue: this.queue,
      jobApplicationId,
      autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
    });
    await this.changes.changed(jobApplication.id, jobApplication.profileId);

    return this.getJobApplicationDetail.execute(jobApplicationId, userId);
  }
}

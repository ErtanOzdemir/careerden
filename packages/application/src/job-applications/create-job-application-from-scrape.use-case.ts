import type {
  ApplicationPriority,
  ApplicationStatus,
  JobApplication,
  JobApplicationQueue,
  JobApplicationRepository,
  ScrapeBundle,
} from "@link2cv/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";

export interface CreateJobApplicationFromScrapeInput {
  sourceUrl: string;
  scrapeBundle: ScrapeBundle;
  dateApplied?: string;
  applicationStatus?: ApplicationStatus;
  priority?: ApplicationPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class CreateJobApplicationFromScrapeUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
    private readonly queue: JobApplicationQueue,
  ) {}

  async execute(
    user: AuthenticatedProfileUser,
    input: CreateJobApplicationFromScrapeInput,
  ): Promise<JobApplication> {
    const profile = await this.getCurrentProfile.execute(user);
    const scrape = input.scrapeBundle;
    const jobApplication = await this.jobApplications.create({
      profileId: profile.id,
      sourceUrl: input.sourceUrl,
      companyName: scrape.job.companyName,
      roleTitle: scrape.job.title,
      roleType: scrape.job.location,
      jobUrl: input.sourceUrl,
      dateApplied: input.dateApplied,
      applicationStatus: input.applicationStatus,
      priority: input.priority,
      tags: input.tags,
      metadata: input.metadata,
    });

    await this.jobApplications.saveScrapeBundle(jobApplication.id, scrape);
    await this.jobApplications.updateStatus(jobApplication.id, "scraped");
    await this.jobApplications.addEvent({
      jobApplicationId: jobApplication.id,
      type: "processing",
      title: "Desktop scrape received",
      metadata: { companyName: scrape.job.companyName, roleTitle: scrape.job.title },
    });
    await enqueueMatchAnalysisIfEnabled({
      jobApplications: this.jobApplications,
      queue: this.queue,
      jobApplicationId: jobApplication.id,
      autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
    });
    return jobApplication;
  }
}

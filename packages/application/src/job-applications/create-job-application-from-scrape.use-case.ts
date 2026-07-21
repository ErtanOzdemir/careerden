import type {
  ApplicationPriority,
  ApplicationStatus,
  JobApplication,
  PersistenceUnitOfWork,
  ScrapeBundle,
} from "@careerden/domain";
import { assessProfileReadiness } from "@careerden/domain";
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
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(
    user: AuthenticatedProfileUser,
    input: CreateJobApplicationFromScrapeInput,
  ): Promise<JobApplication> {
    const profile = await this.getCurrentProfile.execute(user);
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, outbox }) => {
      const scrape = input.scrapeBundle;
      const jobApplication = await jobApplications.create({
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

      await jobApplications.saveScrapeBundle(jobApplication.id, scrape);
      await jobApplications.updateStatus(jobApplication.id, "scraped");
      await jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "Desktop scrape received",
        metadata: { companyName: scrape.job.companyName, roleTitle: scrape.job.title },
      });
      await enqueueMatchAnalysisIfEnabled({
        jobApplications,
        outbox,
        jobApplicationId: jobApplication.id,
        autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
        profileReadiness: assessProfileReadiness(profile),
      });
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return jobApplication;
    });
  }
}

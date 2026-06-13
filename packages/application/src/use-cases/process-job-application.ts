import type {
  JobApplicationRepository,
  JobSiteScraper,
  ScrapeBundle,
  UserProfileRepository
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import type { GenerateDocumentsUseCase } from "./generate-documents.js";
import type { RunMatchAnalysisUseCase } from "./run-match-analysis.js";

export class ProcessJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly scrapers: {
      job: JobSiteScraper;
      companyLinkedIn: JobSiteScraper;
      companyWebsite: JobSiteScraper;
      careerPage: JobSiteScraper;
    },
    private readonly matching: RunMatchAnalysisUseCase,
    private readonly documentGeneration: GenerateDocumentsUseCase
  ) {}

  async execute(jobApplicationId: string): Promise<void> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${jobApplicationId} was not found`);
    }

    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new Error(`Profile ${jobApplication.profileId} was not found`);
    }

    try {
      await this.transition(jobApplicationId, jobApplication.status, "scraping");

      const job = await this.scrapers.job.scrapeJob(jobApplication.sourceUrl);
      const companyLinkedIn = await this.scrapers.companyLinkedIn.scrapeCompany({
        companyName: job.companyName,
        linkedInUrl: job.companyLinkedInUrl
      });
      const companyWebsite = companyLinkedIn.websiteUrl
        ? await this.scrapers.companyWebsite.scrapeCompany({
            companyName: job.companyName,
            websiteUrl: companyLinkedIn.websiteUrl
          })
        : undefined;
      const careerPage = companyWebsite?.careerPageUrl
        ? await this.scrapers.careerPage.scrapeCompany({
            companyName: job.companyName,
            websiteUrl: companyWebsite.careerPageUrl
          })
        : undefined;

      const scrape: ScrapeBundle = {
        job,
        companyLinkedIn,
        companyWebsite,
        careerPage
      };

      await this.jobApplications.saveScrapeBundle(jobApplicationId, scrape);
      await this.transition(jobApplicationId, "scraping", "analyzing");

      const analysis = await this.matching.execute({
        jobApplicationId,
        profile,
        scrape
      });

      await this.transition(jobApplicationId, "analyzing", "generating_documents");

      await this.documentGeneration.execute({
        jobApplicationId,
        profile,
        analysis
      });

      await this.transition(jobApplicationId, "generating_documents", "completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await this.jobApplications.updateStatus(jobApplicationId, "failed", message);
      throw error;
    }
  }

  private async transition(
    jobApplicationId: string,
    from: Parameters<typeof canTransitionJobApplicationStatus>[0],
    to: Parameters<typeof canTransitionJobApplicationStatus>[1]
  ): Promise<void> {
    if (!canTransitionJobApplicationStatus(from, to)) {
      throw new Error(`Invalid job application status transition: ${from} -> ${to}`);
    }

    await this.jobApplications.updateStatus(jobApplicationId, to);
  }
}

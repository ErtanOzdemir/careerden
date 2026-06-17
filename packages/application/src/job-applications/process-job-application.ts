import type {
  JobApplicationRepository,
  JobSiteScraper,
  ScrapeBundle,
  UserProfileRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import type { GenerateDocumentsUseCase } from "../documents/generate-documents.js";
import type { ExtractJobRequirementsUseCase } from "../matching/extract-job-requirements.js";
import type { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.js";

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
    private readonly requirementExtraction: ExtractJobRequirementsUseCase,
    private readonly matching: RunMatchAnalysisUseCase,
    private readonly documentGeneration: GenerateDocumentsUseCase,
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

    if (!jobApplication.sourceUrl) {
      throw new Error(`Job application ${jobApplicationId} does not have a source URL to scrape`);
    }

    try {
      await this.transition(jobApplicationId, jobApplication.status, "scraping");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping started",
      });

      const scrapedJob = await this.scrapers.job.scrapeJob(jobApplication.sourceUrl);
      const job = await this.requirementExtraction.execute({
        jobApplicationId,
        job: scrapedJob,
      });
      const companyLinkedIn = await this.scrapers.companyLinkedIn.scrapeCompany({
        companyName: job.companyName,
        linkedInUrl: job.companyLinkedInUrl,
      });
      const companyWebsite = companyLinkedIn.websiteUrl
        ? await this.scrapers.companyWebsite.scrapeCompany({
            companyName: job.companyName,
            websiteUrl: companyLinkedIn.websiteUrl,
          })
        : undefined;
      const careerPage = companyWebsite?.careerPageUrl
        ? await this.scrapers.careerPage.scrapeCompany({
            companyName: job.companyName,
            websiteUrl: companyWebsite.careerPageUrl,
          })
        : undefined;

      const scrape: ScrapeBundle = {
        job,
        companyLinkedIn,
        companyWebsite,
        careerPage,
      };

      await this.jobApplications.saveScrapeBundle(jobApplicationId, scrape);
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping completed",
        metadata: { companyName: job.companyName, roleTitle: job.title },
      });
      await this.transition(jobApplicationId, "scraping", "analyzing");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "AI analysis started",
      });

      const analysis = await this.matching.execute({
        jobApplicationId,
        profile,
        scrape,
      });

      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "AI analysis completed",
        metadata: { matchScore: analysis.matchScore },
      });
      await this.transition(jobApplicationId, "analyzing", "generating_documents");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Document generation started",
      });

      await this.documentGeneration.execute({
        jobApplicationId,
        profile,
        analysis,
      });

      await this.transition(jobApplicationId, "generating_documents", "completed");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Document generation completed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await this.jobApplications.updateStatus(jobApplicationId, "failed", message);
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Processing failed",
        body: message,
      });
      throw error;
    }
  }

  private async transition(
    jobApplicationId: string,
    from: Parameters<typeof canTransitionJobApplicationStatus>[0],
    to: Parameters<typeof canTransitionJobApplicationStatus>[1],
  ): Promise<void> {
    if (!canTransitionJobApplicationStatus(from, to)) {
      throw new Error(`Invalid job application status transition: ${from} -> ${to}`);
    }

    await this.jobApplications.updateStatus(jobApplicationId, to);
  }
}

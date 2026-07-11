import type {
  FileStorage,
  JobApplicationRepository,
  JobSiteScraper,
  RemoteImageFetcher,
  ScrapedCompany,
  ScrapeBundle,
  UserProfileRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import type { ExtractJobRequirementsUseCase } from "../matching/extract-job-requirements.use-case.js";
import type { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.use-case.js";

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
    private readonly requirementExtraction?: ExtractJobRequirementsUseCase,
    private readonly matching?: RunMatchAnalysisUseCase,
    private readonly storage?: FileStorage,
    private readonly remoteImages?: RemoteImageFetcher,
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
      const job = this.requirementExtraction
        ? await this.requirementExtraction.execute({
            jobApplicationId,
            job: scrapedJob,
          })
        : scrapedJob;
      const scrapedCompanyLinkedIn = await this.scrapers.companyLinkedIn.scrapeCompany({
        companyName: job.companyName,
        linkedInUrl: job.companyLinkedInUrl,
      });
      const companyLinkedIn = await this.storeCompanyLogo(jobApplicationId, scrapedCompanyLinkedIn);
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
      await this.transition(jobApplicationId, "scraping", "scraped");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping completed",
        metadata: { companyName: job.companyName, roleTitle: job.title },
      });

      if (this.matching) {
        await this.transition(jobApplicationId, "scraped", "analyzing");
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
        await this.transition(jobApplicationId, "analyzing", "review_ready");
        await this.jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Ready for AI match review",
          metadata: { matchScore: analysis.matchScore },
        });
      } else {
        await this.transition(jobApplicationId, "scraped", "review_ready");
        await this.jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Scrape ready for review",
          metadata: { companyName: job.companyName, roleTitle: job.title },
        });
      }
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

  private async storeCompanyLogo(
    jobApplicationId: string,
    company: ScrapedCompany,
  ): Promise<ScrapedCompany> {
    if (!company.logoUrl || !this.storage || !this.remoteImages) {
      return company;
    }

    try {
      const image = await this.remoteImages.fetch(company.logoUrl);
      const stored = await this.storage.put({
        fileName: `company-logo.${extensionForContentType(image.contentType)}`,
        contentType: image.contentType,
        body: image.body,
        metadata: {
          jobApplicationId,
          kind: "company_logo",
          companyName: company.name,
        },
      });

      return { ...company, logoFileId: stored.id };
    } catch {
      return company;
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

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

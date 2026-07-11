import type {
  FileStorage,
  JobApplicationRepository,
  JobSiteScraper,
  PersistenceUnitOfWork,
  RemoteImageFetcher,
  ScrapedCompany,
  ScrapeBundle,
  UserProfileRepository,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import type { ExtractJobRequirementsUseCase } from "../matching/extract-job-requirements.use-case.js";
import type { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.use-case.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

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
    private readonly unitOfWork: PersistenceUnitOfWork,
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

    let logoFileId: string | undefined;
    let scrapePersisted = false;
    try {
      await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
        if (jobApplication.status !== "queued" && jobApplication.status !== "scraped") {
          throw new Error(
            `Invalid job application status transition: ${jobApplication.status} -> scraping`,
          );
        }
        await jobApplications.updateStatus(jobApplicationId, "scraping");
        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Scraping started",
        });
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
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
      logoFileId = companyLinkedIn.logoFileId;
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

      await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
        await jobApplications.saveScrapeBundle(jobApplicationId, scrape);
        await jobApplications.updateStatus(jobApplicationId, "scraped");
        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Scraping completed",
          metadata: { companyName: job.companyName, roleTitle: job.title },
        });
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      });
      scrapePersisted = true;

      if (this.matching) {
        const attemptId = randomUUID();
        await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
          await jobApplications.setAnalysisAttempt(jobApplicationId, attemptId);
          if (!(await jobApplications.beginAnalysis(jobApplicationId, attemptId))) {
            throw new Error("Could not start AI analysis");
          }
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "AI analysis started",
            metadata: { attemptId },
          });
          await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
        });

        const analysis = await this.matching.execute({
          jobApplicationId,
          profile,
          scrape,
        });
        await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
          if (
            !(await jobApplications.completeAnalysis(
              jobApplicationId,
              attemptId,
              analysis,
              documentContentFromMatchAnalysis(analysis),
            ))
          ) {
            throw new Error("AI analysis was superseded");
          }
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "AI analysis completed",
            metadata: { matchScore: analysis.matchScore, attemptId },
          });
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "Ready for AI match review",
            metadata: { matchScore: analysis.matchScore, attemptId },
          });
          await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
        });
      } else {
        await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
          await jobApplications.updateStatus(jobApplicationId, "review_ready");
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "Scrape ready for review",
            metadata: { companyName: job.companyName, roleTitle: job.title },
          });
          await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
        await jobApplications.updateStatus(jobApplicationId, "failed", message);
        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Processing failed",
          body: message,
        });
        if (logoFileId && !scrapePersisted) {
          await enqueueStorageDeletions(outbox, [logoFileId]);
        }
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
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
      const fileName = `company-logo.${extensionForContentType(image.contentType)}`;
      const stored = await this.storage.put({
        key: `job-applications/${jobApplicationId}/company-logo/${fileName}`,
        fileName,
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

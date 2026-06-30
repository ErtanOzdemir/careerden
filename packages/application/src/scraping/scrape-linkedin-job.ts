import type { JobSiteScraper, ScrapedCompany, ScrapedJob } from "@link2cv/domain";

export interface ScrapeLinkedInJobResult {
  job: ScrapedJob;
  companyLinkedIn: ScrapedCompany;
}

export class ScrapeLinkedInJobUseCase {
  constructor(
    private readonly jobScraper: JobSiteScraper,
    private readonly companyScraper: JobSiteScraper,
  ) {}

  async execute(sourceUrl: string): Promise<ScrapeLinkedInJobResult> {
    const job = await this.jobScraper.scrapeJob(sourceUrl);
    const companyLinkedIn = await this.companyScraper.scrapeCompany({
      companyName: job.companyName,
      linkedInUrl: job.companyLinkedInUrl,
    });

    return { job, companyLinkedIn };
  }
}

import type { JobSiteScraper, ScrapedCompany, ScrapedJob } from "@careerden/domain";

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
    const scrapedJob = await this.jobScraper.scrapeJob(sourceUrl);
    const companyLinkedIn = await this.companyScraper.scrapeCompany({
      companyName: scrapedJob.companyName,
      linkedInUrl: scrapedJob.companyLinkedInUrl,
      logoUrl: scrapedJob.companyLogoUrl,
    });
    const { companyLogoUrl: _companyLogoUrl, ...job } = scrapedJob;

    return { job, companyLinkedIn };
  }
}

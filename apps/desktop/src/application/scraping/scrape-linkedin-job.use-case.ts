import type { JobSiteScraper } from "../../domain/scraping/job-site-scraper.js";
import type { CompanyLookupInput, ScrapedCompany, ScrapedJob } from "@careerden/domain";

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
    const companyLinkedIn = await this.lookUpCompany({
      companyName: scrapedJob.companyName,
      linkedInUrl: scrapedJob.companyLinkedInUrl,
      logoUrl: scrapedJob.companyLogoUrl,
    });
    const { companyLogoUrl: _companyLogoUrl, ...job } = scrapedJob;

    return { job, companyLinkedIn };
  }

  /**
   * LinkedIn denies guest company pages unpredictably, usually with 403 or an authentication
   * wall. The job itself is already scraped by this point, so a company lookup failure keeps the
   * import alive with the details the job page carried instead of discarding the whole scrape and
   * retrying until the application is marked failed. The job page's logo and company URL are
   * already validated by the job scraper, so the fallback reuses them as they are.
   */
  private async lookUpCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    try {
      return await this.companyScraper.scrapeCompany(input);
    } catch (error) {
      return {
        name: input.companyName,
        ...(input.linkedInUrl ? { linkedInUrl: input.linkedInUrl } : {}),
        ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
        raw: {
          adapter: "linkedin-company",
          input,
          websiteExtracted: false,
          reason: "company_lookup_failed",
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

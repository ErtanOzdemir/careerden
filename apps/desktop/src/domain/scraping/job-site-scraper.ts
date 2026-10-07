import type { CompanyLookupInput, ScrapedCompany, ScrapedJob } from "@careerden/domain";

export interface JobSiteScraper {
  canHandle(url: string): boolean;
  scrapeJob(url: string): Promise<ScrapedJob>;
  scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany>;
}

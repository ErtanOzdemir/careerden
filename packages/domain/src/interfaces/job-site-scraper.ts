import type { CompanyLookupInput, ScrapedCompany, ScrapedJob } from "../entities/scraped-data.js";

export interface JobSiteScraper {
  canHandle(url: string): boolean;
  scrapeJob(url: string): Promise<ScrapedJob>;
  scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany>;
}

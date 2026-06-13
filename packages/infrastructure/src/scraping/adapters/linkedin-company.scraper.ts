import type { CompanyLookupInput, JobSiteScraper, ScrapedCompany, ScrapedJob } from "@link2cv/domain";

export class LinkedInCompanyScraper implements JobSiteScraper {
  canHandle(url: string): boolean {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/company/");
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    throw new Error(`LinkedInCompanyScraper cannot scrape job URL: ${url}`);
  }

  async scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    return {
      name: input.companyName,
      linkedInUrl: input.linkedInUrl,
      raw: {
        adapter: "linkedin-company",
        input
      }
    };
  }
}

import type { CompanyLookupInput, JobSiteScraper, ScrapedCompany, ScrapedJob } from "@link2cv/domain";

export class CareerPageScraper implements JobSiteScraper {
  canHandle(url: string): boolean {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().includes("career") || parsed.pathname.toLowerCase().includes("jobs");
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    throw new Error(`CareerPageScraper cannot scrape job URL: ${url}`);
  }

  async scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    return {
      name: input.companyName,
      careerPageUrl: input.websiteUrl,
      raw: {
        adapter: "career-page",
        input
      }
    };
  }
}

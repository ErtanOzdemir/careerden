import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@link2cv/domain";

export class CompanyWebsiteScraper implements JobSiteScraper {
  canHandle(url: string): boolean {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    throw new Error(`CompanyWebsiteScraper cannot scrape job URL: ${url}`);
  }

  async scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    return {
      name: input.companyName,
      websiteUrl: input.websiteUrl,
      raw: {
        adapter: "company-website",
        input,
      },
    };
  }
}

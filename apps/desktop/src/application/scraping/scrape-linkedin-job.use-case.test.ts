import { describe, expect, it, vi } from "vitest";
import type { CompanyLookupInput } from "@careerden/domain";
import type { JobSiteScraper } from "../../domain/scraping/job-site-scraper.js";
import { ScrapeLinkedInJobUseCase } from "./scrape-linkedin-job.use-case.js";

describe("ScrapeLinkedInJobUseCase", () => {
  it("passes the job-post logo to company scraping without persisting it on the job", async () => {
    const companyLogoUrl = "https://media.licdn.com/dms/image/job-post-logo";
    const scrapeCompany = vi.fn(async (input: CompanyLookupInput) => ({
      name: input.companyName,
      linkedInUrl: input.linkedInUrl,
      logoUrl: input.logoUrl,
      raw: {},
    }));
    const jobScraper = {
      canHandle: () => true,
      scrapeJob: async () => ({
        title: "Backend Engineer",
        companyName: "Acme",
        description: "Build TypeScript services.",
        requirements: [],
        companyLinkedInUrl: "https://www.linkedin.com/company/acme/",
        companyLogoUrl,
        raw: { companyLogoUrl },
      }),
      scrapeCompany: async () => {
        throw new Error("Job scraper does not scrape companies");
      },
    } satisfies JobSiteScraper;
    const companyScraper = {
      canHandle: () => true,
      scrapeJob: async () => {
        throw new Error("Company scraper does not scrape jobs");
      },
      scrapeCompany,
    } satisfies JobSiteScraper;

    const result = await new ScrapeLinkedInJobUseCase(jobScraper, companyScraper).execute(
      "https://www.linkedin.com/jobs/view/4300011451",
    );

    expect(scrapeCompany).toHaveBeenCalledWith({
      companyName: "Acme",
      linkedInUrl: "https://www.linkedin.com/company/acme/",
      logoUrl: companyLogoUrl,
    });
    expect(result.companyLinkedIn.logoUrl).toBe(companyLogoUrl);
    expect(result.job).not.toHaveProperty("companyLogoUrl");
    expect(result.job.raw).toEqual({ companyLogoUrl });
  });

  it("keeps the scraped job when LinkedIn denies the company page", async () => {
    const companyLogoUrl = "https://media.licdn.com/dms/image/job-post-logo";
    const jobScraper = {
      canHandle: () => true,
      scrapeJob: async () => ({
        title: "Backend Engineer",
        companyName: "Acme",
        description: "Build TypeScript services.",
        requirements: [],
        companyLinkedInUrl: "https://www.linkedin.com/company/acme/",
        companyLogoUrl,
        raw: { companyLogoUrl },
      }),
      scrapeCompany: async () => {
        throw new Error("Job scraper does not scrape companies");
      },
    } satisfies JobSiteScraper;
    const companyScraper = {
      canHandle: () => true,
      scrapeJob: async () => {
        throw new Error("Company scraper does not scrape jobs");
      },
      scrapeCompany: async () => {
        throw new Error("LinkedIn public company fetch failed: 403 Forbidden");
      },
    } satisfies JobSiteScraper;

    const result = await new ScrapeLinkedInJobUseCase(jobScraper, companyScraper).execute(
      "https://www.linkedin.com/jobs/view/4300011451",
    );

    expect(result.job.title).toBe("Backend Engineer");
    expect(result.companyLinkedIn).toMatchObject({
      name: "Acme",
      linkedInUrl: "https://www.linkedin.com/company/acme/",
      logoUrl: companyLogoUrl,
    });
    expect(result.companyLinkedIn.raw).toMatchObject({
      reason: "company_lookup_failed",
      error: "LinkedIn public company fetch failed: 403 Forbidden",
    });
  });

  it("omits company details the job page did not carry", async () => {
    const jobScraper = {
      canHandle: () => true,
      scrapeJob: async () => ({
        title: "Backend Engineer",
        companyName: "Acme",
        description: "Build TypeScript services.",
        requirements: [],
        raw: {},
      }),
      scrapeCompany: async () => {
        throw new Error("Job scraper does not scrape companies");
      },
    } satisfies JobSiteScraper;
    const companyScraper = {
      canHandle: () => true,
      scrapeJob: async () => {
        throw new Error("Company scraper does not scrape jobs");
      },
      scrapeCompany: async () => {
        throw new Error("LinkedIn required authentication");
      },
    } satisfies JobSiteScraper;

    const result = await new ScrapeLinkedInJobUseCase(jobScraper, companyScraper).execute(
      "https://www.linkedin.com/jobs/view/4300011451",
    );

    expect(result.companyLinkedIn.name).toBe("Acme");
    expect(result.companyLinkedIn).not.toHaveProperty("linkedInUrl");
    expect(result.companyLinkedIn).not.toHaveProperty("logoUrl");
  });
});

import { app } from "electron";
import { join } from "node:path";
import {
  CareerPageScraper,
  CompanyWebsiteScraper,
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
} from "@link2cv/infrastructure";
import type { ScrapeBundle } from "@link2cv/domain";

const sessionManager = new LinkedInSessionManager(
  join(app.getPath("userData"), "linkedin-session"),
  process.env.LINKEDIN_SESSION_SECRET ?? "dev-local-linkedin-session-secret",
);

export function getLinkedInSessionManager(): LinkedInSessionManager {
  return sessionManager;
}

export async function scrapeLinkedInJob(sourceUrl: string): Promise<ScrapeBundle> {
  const jobScraper = new LinkedInJobScraper(sessionManager);
  const companyLinkedInScraper = new LinkedInCompanyScraper(sessionManager);
  const companyWebsiteScraper = new CompanyWebsiteScraper();
  const careerPageScraper = new CareerPageScraper();

  const job = await jobScraper.scrapeJob(sourceUrl);
  const companyLinkedIn = await companyLinkedInScraper.scrapeCompany({
    companyName: job.companyName,
    linkedInUrl: job.companyLinkedInUrl,
  });
  const companyWebsite = companyLinkedIn.websiteUrl
    ? await companyWebsiteScraper.scrapeCompany({
        companyName: job.companyName,
        websiteUrl: companyLinkedIn.websiteUrl,
      })
    : undefined;
  const careerPage = companyWebsite?.careerPageUrl
    ? await careerPageScraper.scrapeCompany({
        companyName: job.companyName,
        websiteUrl: companyWebsite.careerPageUrl,
      })
    : undefined;

  return {
    job,
    companyLinkedIn,
    companyWebsite,
    careerPage,
  };
}

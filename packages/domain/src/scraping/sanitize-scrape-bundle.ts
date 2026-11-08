import { stripInvisibleCharacters } from "./invisible-characters.js";
import type { ScrapeBundle, ScrapedCompany, ScrapedJob } from "./scraped-data.js";

/**
 * Strips invisible characters from every normalized text field of a scrape bundle before it is
 * persisted, whether it came from a scraper or a pasted posting. `raw` payloads are left exactly as
 * received so the original input stays traceable.
 */
export function sanitizeScrapeBundleText(bundle: ScrapeBundle): ScrapeBundle {
  return {
    ...bundle,
    job: sanitizeJob(bundle.job),
    ...(bundle.companyManual ? { companyManual: sanitizeCompany(bundle.companyManual) } : {}),
    ...(bundle.companyLinkedIn ? { companyLinkedIn: sanitizeCompany(bundle.companyLinkedIn) } : {}),
    ...(bundle.companyWebsite ? { companyWebsite: sanitizeCompany(bundle.companyWebsite) } : {}),
    ...(bundle.careerPage ? { careerPage: sanitizeCompany(bundle.careerPage) } : {}),
  };
}

function sanitizeJob(job: ScrapedJob): ScrapedJob {
  return {
    ...job,
    title: stripInvisibleCharacters(job.title),
    companyName: stripInvisibleCharacters(job.companyName),
    ...(job.location !== undefined ? { location: stripInvisibleCharacters(job.location) } : {}),
    description: stripInvisibleCharacters(job.description),
    ...(job.descriptionHtml !== undefined
      ? { descriptionHtml: stripInvisibleCharacters(job.descriptionHtml) }
      : {}),
    requirements: job.requirements.map(stripInvisibleCharacters),
  };
}

function sanitizeCompany(company: ScrapedCompany): ScrapedCompany {
  return {
    ...company,
    name: stripInvisibleCharacters(company.name),
    ...(company.description !== undefined
      ? { description: stripInvisibleCharacters(company.description) }
      : {}),
  };
}

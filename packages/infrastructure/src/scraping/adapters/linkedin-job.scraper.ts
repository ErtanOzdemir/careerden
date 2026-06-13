import type { CompanyLookupInput, JobSiteScraper, ScrapedCompany, ScrapedJob } from "@link2cv/domain";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { LinkedInSessionManager } from "../linkedin-session.manager.js";

export class LinkedInJobScraper implements JobSiteScraper {
  constructor(private readonly linkedInSessionManager?: LinkedInSessionManager) {}

  canHandle(url: string): boolean {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/jobs/");
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    if (!this.linkedInSessionManager) {
      throw new Error("linkedin_session_required: LinkedIn job scraping requires a saved browser session");
    }

    const storageState = await this.linkedInSessionManager.getStorageState().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "LinkedIn session is not connected";
      throw new Error(`linkedin_session_required: ${message}`);
    });
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

      if (page.url().includes("/login")) {
        throw new Error("linkedin_session_required: LinkedIn redirected to login");
      }

      const title = await firstText(page, [
        "h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".top-card-layout__title"
      ]);
      const companyName = await firstText(page, [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".top-card-layout__second-subline a"
      ]);
      const location = await firstText(page, [
        ".job-details-jobs-unified-top-card__primary-description-container span",
        ".topcard__flavor--bullet",
        ".job-search-card__location"
      ]);
      const description = await firstText(page, [
        "#job-details",
        ".jobs-description-content__text",
        ".description__text"
      ]);
      const companyLinkedInUrl = await firstHref(page, [
        ".job-details-jobs-unified-top-card__company-name a",
        ".topcard__org-name-link"
      ]);

      if (!description || title.toLowerCase().includes("sign in")) {
        throw new Error("linkedin_session_required: LinkedIn did not expose job details for this session");
      }

      return {
        title: title || "Untitled LinkedIn job",
        companyName: companyName || "Unknown company",
        location,
        description,
        requirements: extractRequirements(description),
        companyLinkedInUrl,
        raw: {
          sourceUrl: url,
          finalUrl: page.url(),
          adapter: "linkedin-job",
          scrapedAt: new Date().toISOString()
        }
      };
    } finally {
      await browser.close();
    }
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

async function firstText(page: Page, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    const text = await locator.textContent().catch(() => undefined);

    if (text?.trim()) {
      return normalizeWhitespace(text);
    }
  }

  return "";
}

async function firstHref(page: Page, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    const href = await locator.getAttribute("href").catch(() => undefined);

    if (href?.trim()) {
      return href.startsWith("http") ? href : `https://www.linkedin.com${href}`;
    }
  }

  return undefined;
}

function extractRequirements(description: string): string[] {
  return description
    .split(/\n|•|·|-/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 8)
    .slice(0, 30);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

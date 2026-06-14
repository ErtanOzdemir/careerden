import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@link2cv/domain";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { LinkedInSessionManager } from "../linkedin-session.manager.js";

export class LinkedInCompanyScraper implements JobSiteScraper {
  constructor(private readonly linkedInSessionManager?: LinkedInSessionManager) {}

  canHandle(url: string): boolean {
    const parsed = parseUrl(url);
    return Boolean(
      parsed?.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/company/"),
    );
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    throw new Error(`LinkedInCompanyScraper cannot scrape job URL: ${url}`);
  }

  async scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    const aboutUrl = normalizeLinkedInCompanyAboutUrl(input.linkedInUrl);

    if (!aboutUrl) {
      return {
        name: input.companyName,
        linkedInUrl: input.linkedInUrl,
        raw: {
          adapter: "linkedin-company",
          input,
          websiteExtracted: false,
          reason: "missing_linkedin_company_url",
        },
      };
    }

    if (!this.linkedInSessionManager) {
      throw new Error(
        "linkedin_session_required: LinkedIn company scraping requires a saved browser session",
      );
    }

    const storageState = await this.linkedInSessionManager
      .getStorageState()
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "LinkedIn session is not connected";
        throw new Error(`linkedin_session_required: ${message}`);
      });
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      await page.goto(aboutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

      if (page.url().includes("/login")) {
        throw new Error("linkedin_session_required: LinkedIn redirected to login");
      }

      const websiteUrl = await extractLinkedInCompanyWebsiteUrl(page);
      const description = await firstText(page, [
        ".org-about-us-organization-description__text",
        ".org-page-details__definition-text",
        "section.org-page-details-module",
      ]);

      return {
        name: input.companyName,
        linkedInUrl: input.linkedInUrl,
        websiteUrl,
        description: description || undefined,
        raw: {
          adapter: "linkedin-company",
          input,
          aboutUrl,
          finalUrl: page.url(),
          websiteExtracted: Boolean(websiteUrl),
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await browser.close();
    }
  }
}

export function normalizeLinkedInCompanyAboutUrl(linkedInUrl?: string): string | undefined {
  const parsed = parseUrl(linkedInUrl);

  if (!parsed?.hostname.endsWith("linkedin.com")) {
    return undefined;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const companySegmentIndex = segments.findIndex((segment) => segment.toLowerCase() === "company");
  const slug = companySegmentIndex >= 0 ? segments[companySegmentIndex + 1] : undefined;

  if (!slug) {
    return undefined;
  }

  return `${parsed.origin}/company/${slug}/about/`;
}

export function chooseExternalCompanyWebsiteUrl(
  candidates: Array<string | undefined>,
): string | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeExternalWebsiteCandidate(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function chooseLinkedInAboutWebsiteUrl(
  fields: Array<{ label: string; href?: string; text?: string }>,
): string | undefined {
  const websiteField = fields.find(
    (field) => normalizeWhitespace(field.label).toLowerCase() === "website",
  );

  if (!websiteField) {
    return undefined;
  }

  return chooseExternalCompanyWebsiteUrl([websiteField.href, websiteField.text]);
}

async function extractLinkedInCompanyWebsiteUrl(page: Page): Promise<string | undefined> {
  const websiteDefinition = page
    .locator("dt")
    .filter({ hasText: /^\s*Website\s*$/i })
    .first();

  if ((await websiteDefinition.count()) === 0) {
    return undefined;
  }

  const value = websiteDefinition.locator("xpath=following-sibling::dd[1]");
  const link = value.locator("a[href]").first();
  const href =
    (await link.count()) > 0 ? await link.getAttribute("href").catch(() => undefined) : undefined;
  const text = await value.textContent().catch(() => undefined);

  return chooseLinkedInAboutWebsiteUrl([
    {
      label: "Website",
      href: href ?? undefined,
      text: text ?? undefined,
    },
  ]);
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

function normalizeExternalWebsiteCandidate(candidate: string | undefined): string | undefined {
  if (!candidate?.trim()) {
    return undefined;
  }

  const directCandidate = normalizeUrlCandidate(candidate);
  const parsedDirectCandidate = parseUrl(directCandidate);

  if (parsedDirectCandidate?.hostname.endsWith("linkedin.com")) {
    const redirectedUrl = parsedDirectCandidate.searchParams.get("url");
    const normalizedRedirectedUrl = normalizeUrlCandidate(redirectedUrl ?? undefined);
    const parsedRedirectedUrl = parseUrl(normalizedRedirectedUrl);

    return isExternalHttpUrl(parsedRedirectedUrl) ? parsedRedirectedUrl.href : undefined;
  }

  return isExternalHttpUrl(parsedDirectCandidate) ? parsedDirectCandidate.href : undefined;
}

function normalizeUrlCandidate(candidate: string | undefined): string | undefined {
  const value = candidate
    ?.trim()
    .replace(/^["'(<[]+/, "")
    .replace(/[)"'>\],.]+$/, "");

  if (!value || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) {
    return `https://${value}`;
  }

  return undefined;
}

function isExternalHttpUrl(url: URL | undefined): url is URL {
  return Boolean(
    url && ["http:", "https:"].includes(url.protocol) && !url.hostname.endsWith("linkedin.com"),
  );
}

function parseUrl(value: string | undefined): URL | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

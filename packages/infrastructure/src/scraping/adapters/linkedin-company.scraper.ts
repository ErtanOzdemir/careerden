import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@careerden/domain";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { LinkedInSessionManager } from "../linkedin-session.manager.js";

export type LinkedInCompanyFetchStrategy = "guest" | "browser-session";

export interface LinkedInCompanyScraperOptions {
  fetch?: typeof fetch;
  strategy?: LinkedInCompanyFetchStrategy;
}

export const linkedInGuestCompanyParserVersion = "linkedin-guest-company-v1";

export class LinkedInCompanyScraper implements JobSiteScraper {
  private readonly strategy: LinkedInCompanyScrapeStrategy;

  constructor(
    linkedInSessionManager?: LinkedInSessionManager,
    options: LinkedInCompanyScraperOptions = {},
  ) {
    this.strategy = createLinkedInCompanyScrapeStrategy({
      fetchImpl: options.fetch ?? fetch,
      linkedInSessionManager,
      strategy: options.strategy ?? "guest",
    });
  }

  canHandle(url: string): boolean {
    const parsed = parseUrl(url);
    return Boolean(
      parsed && isLinkedInHostname(parsed.hostname) && parsed.pathname.includes("/company/"),
    );
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    throw new Error(`LinkedInCompanyScraper cannot scrape job URL: ${url}`);
  }

  async scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany> {
    const companyUrl = normalizeLinkedInCompanyUrl(input.linkedInUrl);

    if (!companyUrl) {
      return {
        name: input.companyName,
        linkedInUrl: input.linkedInUrl,
        logoUrl: chooseLinkedInCompanyLogoUrl([{ src: input.logoUrl }]),
        raw: {
          adapter: "linkedin-company",
          input,
          websiteExtracted: false,
          reason: "missing_linkedin_company_url",
        },
      };
    }

    return this.strategy.scrape(input, companyUrl);
  }
}

interface LinkedInCompanyScrapeStrategy {
  readonly name: LinkedInCompanyFetchStrategy;
  scrape(input: CompanyLookupInput, companyUrl: string): Promise<ScrapedCompany>;
}

function createLinkedInCompanyScrapeStrategy(input: {
  fetchImpl: typeof fetch;
  linkedInSessionManager?: LinkedInSessionManager;
  strategy: LinkedInCompanyFetchStrategy;
}): LinkedInCompanyScrapeStrategy {
  switch (input.strategy) {
    case "guest":
      return new LinkedInGuestCompanyScrapeStrategy(input.fetchImpl);
    case "browser-session":
      return new LinkedInBrowserSessionCompanyScrapeStrategy(input.linkedInSessionManager);
  }
}

class LinkedInGuestCompanyScrapeStrategy implements LinkedInCompanyScrapeStrategy {
  readonly name = "guest";

  constructor(private readonly fetchImpl: typeof fetch) {}

  async scrape(input: CompanyLookupInput, companyUrl: string): Promise<ScrapedCompany> {
    const response = await fetchLinkedInGuestCompanyHtml(this.fetchImpl, companyUrl);

    return parseLinkedInGuestCompanyHtml(response.html, {
      companyUrl,
      finalUrl: response.finalUrl,
      input,
      strategy: this.name,
    });
  }
}

class LinkedInBrowserSessionCompanyScrapeStrategy implements LinkedInCompanyScrapeStrategy {
  readonly name = "browser-session";

  constructor(private readonly linkedInSessionManager?: LinkedInSessionManager) {}

  async scrape(input: CompanyLookupInput, companyUrl: string): Promise<ScrapedCompany> {
    const aboutUrl = normalizeLinkedInCompanyAboutUrl(companyUrl);

    if (!aboutUrl) {
      throw new Error("LinkedIn company URL could not be normalized");
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
      const logoUrl =
        chooseLinkedInCompanyLogoUrl([{ src: input.logoUrl }]) ??
        (await extractLinkedInCompanyLogoUrl(page));
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
        logoUrl,
        raw: {
          adapter: "linkedin-company",
          strategy: this.name,
          input,
          aboutUrl,
          finalUrl: page.url(),
          websiteExtracted: Boolean(websiteUrl),
          logoExtracted: Boolean(logoUrl),
          scrapedAt: new Date().toISOString(),
        },
      };
    } finally {
      await browser.close();
    }
  }
}

export interface ParseLinkedInGuestCompanyInput {
  companyUrl: string;
  finalUrl: string;
  input: CompanyLookupInput;
  strategy: Extract<LinkedInCompanyFetchStrategy, "guest">;
}

export function parseLinkedInGuestCompanyHtml(
  html: string,
  input: ParseLinkedInGuestCompanyInput,
): ScrapedCompany {
  if (isLinkedInAuthenticationPage(input.finalUrl, html)) {
    throw new Error("linkedin_guest_company_unavailable: LinkedIn required authentication");
  }

  const organization = extractLinkedInOrganizationData(html);
  const metaDescription = getMetaContent(html, "og:description");
  const name =
    cleanHtmlText(asString(organization?.name)) ||
    cleanLinkedInPageTitle(getMetaContent(html, "og:title")) ||
    input.input.companyName;
  const description =
    cleanHtmlText(asString(organization?.description)) || cleanHtmlText(metaDescription);
  const websiteUrl = chooseExternalCompanyWebsiteUrl([
    ...asStringArray(organization?.sameAs),
    asString(organization?.url),
    extractLinkedInCompanyWebsiteUrlFromHtml(html),
  ]);
  const logoUrl = chooseLinkedInCompanyLogoUrl([{ src: input.input.logoUrl }]);

  if (!organization && !description && !websiteUrl && !logoUrl) {
    throw new Error("LinkedIn public company details were not exposed");
  }

  return {
    name,
    linkedInUrl: input.companyUrl,
    websiteUrl,
    description: description || undefined,
    logoUrl,
    raw: {
      adapter: "linkedin-company",
      strategy: input.strategy,
      parserVersion: linkedInGuestCompanyParserVersion,
      input: input.input,
      companyUrl: input.companyUrl,
      finalUrl: input.finalUrl,
      websiteExtracted: Boolean(websiteUrl),
      logoExtracted: Boolean(logoUrl),
      scrapedAt: new Date().toISOString(),
      html,
    },
  };
}

export function chooseLinkedInCompanyLogoUrl(
  candidates: Array<{ delayedUrl?: string; src?: string; srcset?: string }>,
): string | undefined {
  for (const candidate of candidates) {
    const urls = [...parseSrcset(candidate.srcset), candidate.delayedUrl, candidate.src].filter(
      (value): value is string => Boolean(value),
    );

    for (const value of urls) {
      const parsed = parseUrl(value);

      if (
        parsed &&
        parsed.protocol === "https:" &&
        (parsed.hostname === "media.licdn.com" || parsed.hostname.endsWith(".licdn.com"))
      ) {
        return parsed.href;
      }
    }
  }

  return undefined;
}

export function normalizeLinkedInCompanyUrl(linkedInUrl?: string): string | undefined {
  const parsed = parseUrl(linkedInUrl);

  if (!parsed || !isLinkedInHostname(parsed.hostname)) {
    return undefined;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const companySegmentIndex = segments.findIndex((segment) => segment.toLowerCase() === "company");
  const slug = companySegmentIndex >= 0 ? segments[companySegmentIndex + 1] : undefined;

  if (!slug) {
    return undefined;
  }

  return `${parsed.origin}/company/${slug}/`;
}

export function normalizeLinkedInCompanyAboutUrl(linkedInUrl?: string): string | undefined {
  const companyUrl = normalizeLinkedInCompanyUrl(linkedInUrl);

  return companyUrl ? `${companyUrl}about/` : undefined;
}

async function fetchLinkedInGuestCompanyHtml(
  fetchImpl: typeof fetch,
  companyUrl: string,
): Promise<{ finalUrl: string; html: string }> {
  const response = await fetchImpl(companyUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (response.status === 404) {
    throw new Error("LinkedIn company was not found");
  }

  if (!response.ok) {
    throw new Error(
      `LinkedIn public company fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  return {
    finalUrl: response.url || companyUrl,
    html: await response.text(),
  };
}

function extractLinkedInOrganizationData(html: string): Record<string, unknown> | undefined {
  const organizations: Array<Record<string, unknown>> = [];
  const scriptPattern =
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const source = match[1]?.trim().replace(/^<!--/, "").replace(/-->$/, "");

    if (!source) {
      continue;
    }

    try {
      collectOrganizationNodes(JSON.parse(source), organizations);
    } catch {
      // Ignore malformed structured data and continue with HTML metadata fallbacks.
    }
  }

  return organizations.sort((left, right) => organizationScore(right) - organizationScore(left))[0];
}

function collectOrganizationNodes(
  value: unknown,
  organizations: Array<Record<string, unknown>>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOrganizationNodes(item, organizations);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (hasSchemaType(value, "Organization")) {
    organizations.push(value);
  }

  if (Array.isArray(value["@graph"])) {
    collectOrganizationNodes(value["@graph"], organizations);
  }
}

function hasSchemaType(value: Record<string, unknown>, expected: string): boolean {
  const schemaType = value["@type"];

  return Array.isArray(schemaType)
    ? schemaType.some((item) => item === expected)
    : schemaType === expected;
}

function organizationScore(value: Record<string, unknown>): number {
  return [value.description, value.logo, value.sameAs, value.numberOfEmployees].filter(Boolean)
    .length;
}

function getMetaContent(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const tagKey = getHtmlAttribute(tag, "property") ?? getHtmlAttribute(tag, "name");

    if (tagKey?.toLowerCase() === key.toLowerCase()) {
      const content = getHtmlAttribute(tag, "content");
      return content ? decodeHtml(content) : undefined;
    }
  }

  return undefined;
}

function extractLinkedInCompanyWebsiteUrlFromHtml(html: string): string | undefined {
  const websiteBlock = html.match(
    /data-test-id=["']about-us__website["'][\s\S]{0,3000}?(?=<div\b[^>]*data-test-id=|<\/dl>|<\/div>)/i,
  )?.[0];

  if (!websiteBlock) {
    return undefined;
  }

  const linkTag = websiteBlock.match(/<a\b[^>]*\bhref\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/i)?.[0];

  return linkTag ? getHtmlAttribute(linkTag, "href") : undefined;
}

function isLinkedInAuthenticationPage(finalUrl: string, html: string): boolean {
  const pathname = parseUrl(finalUrl)?.pathname.toLowerCase() ?? "";

  return (
    pathname.includes("/authwall") ||
    pathname.includes("/uas/login") ||
    pathname === "/login" ||
    /<title[^>]*>\s*(?:sign in|sign up|join linkedin)[^<]*<\/title>/i.test(html)
  );
}

function cleanLinkedInPageTitle(value: string | undefined): string {
  return cleanHtmlText(value)
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
}

function cleanHtmlText(value: string | undefined): string {
  return normalizeWhitespace(decodeHtml((value ?? "").replace(/<[^>]+>/g, " ")));
}

function getHtmlAttribute(tag: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  ).exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value ? decodeHtml(value) : undefined;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }

  const item = asString(value);
  return item ? [item] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLinkedInHostname(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

async function extractLinkedInCompanyLogoUrl(page: Page): Promise<string | undefined> {
  const selectors = [
    ".org-top-card-primary-content__logo-container img",
    "img.org-top-card-primary-content__logo",
    ".org-top-card-primary-content__logo img",
    'img[alt*="logo" i]',
  ];
  const candidates: Array<{ delayedUrl?: string; src?: string; srcset?: string }> = [];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    candidates.push({
      delayedUrl:
        (await locator.getAttribute("data-delayed-url").catch(() => undefined)) ?? undefined,
      src: (await locator.getAttribute("src").catch(() => undefined)) ?? undefined,
      srcset: (await locator.getAttribute("srcset").catch(() => undefined)) ?? undefined,
    });
  }

  return chooseLinkedInCompanyLogoUrl(candidates);
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

  if (parsedDirectCandidate && isLinkedInHostname(parsedDirectCandidate.hostname)) {
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
    url && ["http:", "https:"].includes(url.protocol) && !isLinkedInHostname(url.hostname),
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

function parseSrcset(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
    .reverse();
}

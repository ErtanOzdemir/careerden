import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@link2cv/domain";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { LinkedInSessionManager } from "../linkedin-session.manager.js";

export type LinkedInFetchStrategy = "guest" | "manual" | "browser-session";

export interface LinkedInJobScraperOptions {
  fetch?: typeof fetch;
  strategy?: LinkedInFetchStrategy;
}

export const linkedinGuestJobDetailEndpoint =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
export const linkedInGuestParserVersion = "linkedin-guest-detail-v1";

export class LinkedInJobScraper implements JobSiteScraper {
  private readonly strategy: LinkedInJobScrapeStrategy;

  constructor(
    private readonly linkedInSessionManager?: LinkedInSessionManager,
    options: LinkedInJobScraperOptions = {},
  ) {
    this.strategy = createLinkedInJobScrapeStrategy({
      fetchImpl: options.fetch ?? fetch,
      linkedInSessionManager,
      strategy: options.strategy ?? "guest",
    });
  }

  canHandle(url: string): boolean {
    const parsed = parseUrl(url);
    return Boolean(parsed?.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/jobs/"));
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    return this.strategy.scrape(url);
  }

  private async scrapeJobWithBrowserSession(url: string): Promise<ScrapedJob> {
    if (!this.linkedInSessionManager) {
      throw new Error(
        "linkedin_session_required: LinkedIn job scraping requires a saved browser session",
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

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

      if (page.url().includes("/login")) {
        throw new Error("linkedin_session_required: LinkedIn redirected to login");
      }

      const title = await firstText(page, [
        "h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".top-card-layout__title",
      ]);
      const companyName = await firstText(page, [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".top-card-layout__second-subline a",
      ]);
      const location = await firstText(page, [
        ".job-details-jobs-unified-top-card__primary-description-container span",
        ".topcard__flavor--bullet",
        ".job-search-card__location",
      ]);
      const description = await extractLinkedInJobDescription(page);
      let descriptionText = description.text;
      const rawDescriptionHtml = description.rawHtml;
      const descriptionHtml = description.html;
      if (!descriptionText) {
        descriptionText = await firstText(page, [
          "#job-details",
          ".jobs-description-content__text",
          ".description__text",
        ]);
      }
      const companyLinkedInUrl = await firstHref(page, [
        ".job-details-jobs-unified-top-card__company-name a",
        ".topcard__org-name-link",
      ]);
      const companyLogoUrl = chooseLinkedInJobCompanyLogoUrl(
        await collectLinkedInJobCompanyLogoCandidates(page),
      );

      if (!descriptionText || title.toLowerCase().includes("sign in")) {
        throw new Error(
          "linkedin_session_required: LinkedIn did not expose job details for this session",
        );
      }

      return {
        title: title || "Untitled LinkedIn job",
        companyName: companyName || "Unknown company",
        location,
        description: descriptionText,
        ...(descriptionHtml ? { descriptionHtml } : {}),
        requirements: [],
        companyLinkedInUrl,
        ...(companyLogoUrl ? { companyLogoUrl } : {}),
        raw: {
          sourceUrl: url,
          finalUrl: page.url(),
          adapter: "linkedin-job",
          strategy: "browser-session",
          parserVersion: "linkedin-browser-session-v1",
          scrapedAt: new Date().toISOString(),
          companyLogoUrl,
          ...(rawDescriptionHtml ? { descriptionHtml: rawDescriptionHtml } : {}),
        },
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
        input,
      },
    };
  }
}

interface LinkedInJobScrapeStrategy {
  readonly name: LinkedInFetchStrategy;
  scrape(url: string): Promise<ScrapedJob>;
}

function createLinkedInJobScrapeStrategy(input: {
  fetchImpl: typeof fetch;
  linkedInSessionManager?: LinkedInSessionManager;
  strategy: LinkedInFetchStrategy;
}): LinkedInJobScrapeStrategy {
  switch (input.strategy) {
    case "guest":
      return new LinkedInGuestJobScrapeStrategy(input.fetchImpl);
    case "manual":
      return new LinkedInManualJobScrapeStrategy();
    case "browser-session":
      return new DisabledLinkedInBrowserSessionJobScrapeStrategy();
  }
}

class LinkedInGuestJobScrapeStrategy implements LinkedInJobScrapeStrategy {
  readonly name = "guest";

  constructor(private readonly fetchImpl: typeof fetch) {}

  async scrape(url: string): Promise<ScrapedJob> {
    const jobId = extractLinkedInJobId(url);

    if (!jobId) {
      throw new Error("LinkedIn job id could not be extracted from the source URL");
    }

    const endpoint = `${linkedinGuestJobDetailEndpoint}/${jobId}`;
    const html = await fetchLinkedInHtml(this.fetchImpl, endpoint);

    return parseLinkedInGuestJobDetailHtml(html, {
      sourceUrl: url,
      finalUrl: endpoint,
      strategy: "guest",
      sourceJobId: jobId,
    });
  }
}

class LinkedInManualJobScrapeStrategy implements LinkedInJobScrapeStrategy {
  readonly name = "manual";

  async scrape(): Promise<ScrapedJob> {
    throw new Error("manual LinkedIn strategy is handled by manually created job applications");
  }
}

class DisabledLinkedInBrowserSessionJobScrapeStrategy implements LinkedInJobScrapeStrategy {
  readonly name = "browser-session";

  async scrape(): Promise<ScrapedJob> {
    throw new Error(
      "linkedin_browser_session_disabled: browser-session strategy is reserved for future use",
    );
  }
}

export interface ParseLinkedInGuestJobDetailInput {
  finalUrl: string;
  sourceJobId?: string;
  sourceUrl: string;
  strategy: Extract<LinkedInFetchStrategy, "guest">;
}

export function parseLinkedInGuestJobDetailHtml(
  html: string,
  input: ParseLinkedInGuestJobDetailInput,
): ScrapedJob {
  const title =
    cleanHtmlText(
      matchFirst(html, [
        /class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i,
        /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      ]),
    ) || "Untitled LinkedIn job";
  const companyMatch = html.match(
    /class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
  );
  const companyName =
    cleanHtmlText(
      companyMatch?.[2] ?? matchFirst(html, [/class="topcard__flavor"[^>]*>([\s\S]*?)<\/span>/i]),
    ) || "Unknown company";
  const companyLinkedInUrl = normalizeLinkedInHref(companyMatch?.[1]);
  const location = cleanHtmlText(
    matchFirst(html, [
      /class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i,
      /class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i,
    ]),
  );
  const rawDescriptionHtml = matchFirst(html, [
    /class="(?:show-more-less-html__markup|description__text[^"]*)"[^>]*>([\s\S]*?)<\/div>/i,
  ]);
  const descriptionHtml = rawDescriptionHtml
    ? sanitizeLinkedInJobDescriptionHtml(rawDescriptionHtml)
    : "";
  const description = rawDescriptionHtml
    ? htmlToLinkedInJobDescriptionText(rawDescriptionHtml)
    : "";
  const companyLogoUrl = extractLinkedInCompanyLogoUrlFromHtml(html);

  if (!description || title.toLowerCase().includes("sign in")) {
    throw new Error("LinkedIn public job details were not exposed");
  }

  return {
    title,
    companyName,
    ...(location ? { location } : {}),
    description,
    ...(descriptionHtml ? { descriptionHtml } : {}),
    requirements: [],
    ...(companyLinkedInUrl ? { companyLinkedInUrl } : {}),
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
    raw: {
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl,
      adapter: "linkedin-job",
      strategy: input.strategy,
      parserVersion: linkedInGuestParserVersion,
      sourceJobId: input.sourceJobId,
      scrapedAt: new Date().toISOString(),
      html,
      ...(rawDescriptionHtml ? { descriptionHtml: rawDescriptionHtml } : {}),
      companyLogoUrl,
      criteria: extractLinkedInJobCriteria(html),
    },
  };
}

export function extractLinkedInJobId(input: string): string | undefined {
  const value = input.trim();
  const urn = value.match(/urn:li:jobPosting:(\d+)/);
  if (urn) return urn[1];

  const url = value.match(/-(\d{6,})(?:[/?#]|$)/) ?? value.match(/\/(\d{6,})(?:[/?#]|$)/);
  if (url) return url[1];

  const bare = value.match(/^\d{6,}$/);
  if (bare) return value;

  return parseUrl(value)?.searchParams.get("currentJobId") ?? undefined;
}

export function extractLinkedInCompanyLogoUrlFromHtml(html: string): string | undefined {
  const imageTagMatches = html.matchAll(/<img\b[^>]*>/gi);
  const candidates: Array<{ delayedUrl?: string; src?: string; srcset?: string }> = [];

  for (const imageTagMatch of imageTagMatches) {
    const tag = imageTagMatch[0];
    const className = getHtmlAttribute(tag, "class") ?? "";
    const src = getHtmlAttribute(tag, "src");
    const delayedUrl = getHtmlAttribute(tag, "data-delayed-url");
    const srcset = getHtmlAttribute(tag, "srcset");

    if (
      /(?:artdeco-entity-image|base-search-card__entity-image|entity-image|logo)/i.test(
        className,
      ) ||
      src?.includes("media.licdn.com") ||
      delayedUrl?.includes("media.licdn.com") ||
      srcset?.includes("media.licdn.com")
    ) {
      candidates.push({ delayedUrl, src, srcset });
    }
  }

  return chooseLinkedInJobCompanyLogoUrl(candidates);
}

interface LinkedInJobDescription {
  html?: string;
  rawHtml?: string;
  text: string;
}

export async function extractLinkedInJobDescription(page: Page): Promise<LinkedInJobDescription> {
  for (const selector of [
    "#job-details",
    ".jobs-description-content__text",
    ".description__text",
  ]) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    const rawHtml = await locator.innerHTML().catch(() => undefined);
    const text = rawHtml ? htmlToLinkedInJobDescriptionText(rawHtml) : "";
    const html = rawHtml ? sanitizeLinkedInJobDescriptionHtml(rawHtml) : "";

    if (text) {
      return {
        text,
        ...(html ? { html } : {}),
        ...(rawHtml ? { rawHtml } : {}),
      };
    }
  }

  return { text: "" };
}

const allowedBlockTags = new Set(["p", "h1", "h2", "h3", "ul", "ol", "li"]);
const allowedInlineTags = new Set(["strong", "b", "em", "i", "u", "br", "a"]);
const ignoredContentTags = new Set(["script", "style", "button", "form", "svg", "noscript"]);

export function sanitizeLinkedInJobDescriptionHtml(html: string): string {
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? [];
  const output: string[] = [];
  const openTags: string[] = [];
  let ignoredDepth = 0;

  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<!")) {
      continue;
    }

    if (!token.startsWith("<")) {
      if (ignoredDepth === 0) {
        output.push(escapeHtml(decodeHtml(token)));
      }
      continue;
    }

    const parsed = parseTag(token);
    if (!parsed) {
      continue;
    }

    const tag = normalizeTagName(parsed.name);

    if (ignoredContentTags.has(tag)) {
      if (!parsed.closing && !parsed.selfClosing) ignoredDepth += 1;
      if (parsed.closing && ignoredDepth > 0) ignoredDepth -= 1;
      continue;
    }

    if (ignoredDepth > 0) {
      continue;
    }

    if (!allowedBlockTags.has(tag) && !allowedInlineTags.has(tag)) {
      continue;
    }

    if (parsed.closing) {
      closeTag(tag, output, openTags);
      continue;
    }

    if (tag === "br" || parsed.selfClosing) {
      if (tag === "br") output.push("<br>");
      continue;
    }

    const outputTag = tag === "b" ? "strong" : tag === "i" ? "em" : tag;
    if (outputTag === "a") {
      const href = getSafeHref(parsed.source);
      if (!href) {
        continue;
      }
      output.push(`<a href="${escapeHtml(href)}">`);
      openTags.push(outputTag);
      continue;
    }

    output.push(`<${outputTag}>`);
    openTags.push(outputTag);
  }

  while (openTags.length > 0) {
    output.push(`</${openTags.pop()}>`);
  }

  return removeEmptyBlocks(output.join("").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim());
}

export function htmlToLinkedInJobDescriptionText(html: string): string {
  return decodeHtml(
    sanitizeLinkedInJobDescriptionHtml(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|h[1-3]|li)>/gi, "\n")
      .replace(/<\/(?:ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n");
}

function parseTag(
  token: string,
): { closing: boolean; name: string; selfClosing: boolean; source: string } | null {
  const match = /^<\s*(\/)?\s*([a-zA-Z0-9-]+)([\s\S]*?)(\/)?\s*>$/.exec(token);
  if (!match) {
    return null;
  }

  return {
    closing: Boolean(match[1]),
    name: match[2] ?? "",
    selfClosing: Boolean(match[4]),
    source: token,
  };
}

function normalizeTagName(tag: string): string {
  return tag.toLowerCase();
}

function closeTag(tag: string, output: string[], openTags: string[]): void {
  const outputTag = tag === "b" ? "strong" : tag === "i" ? "em" : tag;
  const index = openTags.lastIndexOf(outputTag);
  if (index === -1) {
    return;
  }

  for (let i = openTags.length - 1; i >= index; i -= 1) {
    output.push(`</${openTags.pop()}>`);
  }
}

function getSafeHref(source: string): string | undefined {
  const match = /\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(source);
  const href = decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!href) {
    return undefined;
  }

  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function removeEmptyBlocks(html: string): string {
  let previous = html;
  let next = previous.replace(/<(p|h[1-3]|li)>\s*<\/\1>/g, "");
  while (next !== previous) {
    previous = next;
    next = previous.replace(/<(p|h[1-3]|li)>\s*<\/\1>/g, "");
  }
  return next;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function fetchLinkedInHtml(fetchImpl: typeof fetch, url: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    redirect: "follow",
  });

  if (response.status === 404) {
    throw new Error("LinkedIn job was not found");
  }

  if (!response.ok) {
    throw new Error(`LinkedIn public fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function matchFirst(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];

    if (value) {
      return value;
    }
  }

  return undefined;
}

function cleanHtmlText(value: string | undefined): string {
  return normalizeWhitespace(decodeHtml((value ?? "").replace(/<[^>]+>/g, " ")));
}

function normalizeLinkedInHref(value: string | undefined): string | undefined {
  const decoded = decodeHtml(value ?? "").trim();

  if (!decoded) {
    return undefined;
  }

  return decoded.startsWith("http") ? decoded.split("?")[0] : `https://www.linkedin.com${decoded}`;
}

function extractLinkedInJobCriteria(html: string): Record<string, string> {
  const criteria: Record<string, string> = {};
  const itemPattern =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null) {
    const key = cleanHtmlText(match[1]).toLowerCase();
    const value = cleanHtmlText(match[2]);

    if (key && value) {
      criteria[key] = value;
    }
  }

  return criteria;
}

function getHtmlAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = pattern.exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value ? decodeHtml(value) : undefined;
}

async function collectLinkedInJobCompanyLogoCandidates(
  page: Page,
): Promise<Array<{ delayedUrl?: string; src?: string; srcset?: string }>> {
  const selectors = [
    ".job-details-jobs-unified-top-card__company-logo img",
    ".top-card-layout__entity-image",
    ".artdeco-entity-image",
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

  return candidates;
}

function chooseLinkedInJobCompanyLogoUrl(
  candidates: Array<{ delayedUrl?: string; src?: string; srcset?: string }>,
): string | undefined {
  for (const candidate of candidates) {
    const urls = [...parseSrcset(candidate.srcset), candidate.delayedUrl, candidate.src].filter(
      (value): value is string => Boolean(value),
    );

    for (const url of urls) {
      const parsed = parseUrl(url);

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

function parseSrcset(srcset: string | undefined): string[] {
  return (srcset ?? "")
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter((value): value is string => Boolean(value));
}

function parseUrl(value: string | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

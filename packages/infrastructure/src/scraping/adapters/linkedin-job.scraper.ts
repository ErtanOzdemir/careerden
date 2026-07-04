import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@link2cv/domain";
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
        raw: {
          sourceUrl: url,
          finalUrl: page.url(),
          adapter: "linkedin-job",
          scrapedAt: new Date().toISOString(),
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

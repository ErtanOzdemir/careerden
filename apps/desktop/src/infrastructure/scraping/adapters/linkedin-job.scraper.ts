import type { CompanyLookupInput, ScrapedCompany, ScrapedJob } from "@careerden/domain";
import {
  ScrapeFailureError,
  scrapeFailureCategoryForHttpStatus,
  stripHiddenHtmlElements,
  stripInvisibleCharacters,
} from "@careerden/domain";
import type { JobSiteScraper } from "../../../domain/scraping/job-site-scraper.js";

export interface LinkedInJobScraperOptions {
  fetch?: typeof fetch;
  logger?: Pick<Console, "warn">;
}

/** A guest request that has not answered by then is reported as a network failure. */
export const linkedInGuestFetchTimeoutMs = 30_000;

export const linkedinGuestJobDetailEndpoint =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
export const linkedInGuestParserVersion = "linkedin-guest-detail-v1";

export class LinkedInJobScraper implements JobSiteScraper {
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Pick<Console, "warn">;

  constructor(options: LinkedInJobScraperOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.logger = options.logger ?? console;
  }

  canHandle(url: string): boolean {
    const parsed = parseUrl(url);
    return Boolean(parsed?.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/jobs/"));
  }

  async scrapeJob(url: string): Promise<ScrapedJob> {
    const jobId = extractLinkedInJobId(url);

    if (!jobId) {
      throw new ScrapeFailureError(
        "parse",
        "LinkedIn job id could not be extracted from the source URL",
      );
    }

    const endpoint = `${linkedinGuestJobDetailEndpoint}/${jobId}`;
    const html = await fetchLinkedInHtml(this.fetchImpl, endpoint);

    try {
      return parseLinkedInGuestJobDetailHtml(html, {
        sourceUrl: url,
        finalUrl: endpoint,
        strategy: "guest",
        sourceJobId: jobId,
      });
    } catch (error) {
      // An unrecognized layout usually means LinkedIn changed the page, which only a release fixes.
      if (error instanceof ScrapeFailureError && error.category === "parse") {
        this.logger.warn("LinkedIn page did not match the expected structure", {
          adapter: "linkedin-job",
          parserVersion: linkedInGuestParserVersion,
          url: endpoint,
          detail: error.detail,
        });
      }
      throw error;
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

export interface ParseLinkedInGuestJobDetailInput {
  finalUrl: string;
  sourceJobId?: string;
  sourceUrl: string;
  strategy: "guest";
}

export function parseLinkedInGuestJobDetailHtml(
  html: string,
  input: ParseLinkedInGuestJobDetailInput,
): ScrapedJob {
  const parsedTitle = cleanHtmlText(
    matchFirst(html, [
      /class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    ]),
  );
  const title = parsedTitle || "Untitled LinkedIn job";
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

  if (title.toLowerCase().includes("sign in")) {
    throw new ScrapeFailureError(
      "blocked",
      "LinkedIn public job details were not exposed: authentication required",
    );
  }

  // Neither a title nor a description means LinkedIn changed the page layout; a recognized page
  // without description text is a posting LinkedIn no longer exposes to guests.
  if (!parsedTitle && !rawDescriptionHtml) {
    throw new ScrapeFailureError(
      "parse",
      "LinkedIn public job details were not exposed: page layout not recognized",
    );
  }

  if (!description) {
    throw new ScrapeFailureError(
      "empty_description",
      "LinkedIn public job details were not exposed: empty description",
    );
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

const allowedBlockTags = new Set(["p", "h1", "h2", "h3", "ul", "ol", "li"]);
const allowedInlineTags = new Set(["strong", "b", "em", "i", "u", "br", "a"]);
const ignoredContentTags = new Set(["script", "style", "button", "form", "svg", "noscript"]);

/**
 * Keeps only the visible, allowlisted markup of a posting. Hidden elements and invisible characters
 * are removed first: they are where instructions aimed at the AI model rather than the reader hide.
 */
export function sanitizeLinkedInJobDescriptionHtml(html: string): string {
  const tokens =
    stripHiddenHtmlElements(html).match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? [];
  const output: string[] = [];
  const openTags: string[] = [];
  let ignoredDepth = 0;

  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<!")) {
      continue;
    }

    if (!token.startsWith("<")) {
      if (ignoredDepth === 0) {
        output.push(escapeHtml(stripInvisibleCharacters(decodeHtml(token))));
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
    .replaceAll(/&#(\d+);/g, (entity, code: string) => decodeCodePoint(entity, Number(code)))
    .replaceAll(/&#x([0-9a-f]+);/gi, (entity, code: string) =>
      decodeCodePoint(entity, Number.parseInt(code, 16)),
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'");
}

function decodeCodePoint(entity: string, value: number): string {
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : entity;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function fetchLinkedInHtml(fetchImpl: typeof fetch, url: string): Promise<string> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(linkedInGuestFetchTimeoutMs),
    });
  } catch (error) {
    throw new ScrapeFailureError(
      "network",
      `LinkedIn could not be reached: ${errorMessage(error)}`,
    );
  }

  if (!response.ok) {
    throw new ScrapeFailureError(
      scrapeFailureCategoryForHttpStatus(response.status),
      response.status === 404
        ? "LinkedIn job was not found"
        : `LinkedIn public fetch failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  try {
    return await response.text();
  } catch (error) {
    throw new ScrapeFailureError(
      "network",
      `LinkedIn response could not be read: ${errorMessage(error)}`,
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  return normalizeWhitespace(
    stripInvisibleCharacters(decodeHtml((value ?? "").replace(/<[^>]+>/g, " "))),
  );
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

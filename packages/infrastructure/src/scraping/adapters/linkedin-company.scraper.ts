import type {
  CompanyLookupInput,
  JobSiteScraper,
  ScrapedCompany,
  ScrapedJob,
} from "@careerden/domain";

export interface LinkedInCompanyScraperOptions {
  fetch?: typeof fetch;
}

export const linkedInGuestCompanyParserVersion = "linkedin-guest-company-v1";

export class LinkedInCompanyScraper implements JobSiteScraper {
  private readonly fetchImpl: typeof fetch;

  constructor(options: LinkedInCompanyScraperOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
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

    const response = await fetchLinkedInGuestCompanyHtml(this.fetchImpl, companyUrl);

    return parseLinkedInGuestCompanyHtml(response.html, {
      companyUrl,
      finalUrl: response.finalUrl,
      input,
      strategy: "guest",
    });
  }
}

export interface ParseLinkedInGuestCompanyInput {
  companyUrl: string;
  finalUrl: string;
  input: CompanyLookupInput;
  strategy: "guest";
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

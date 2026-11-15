/**
 * Typed profile links such as a LinkedIn profile or a personal website.
 *
 * These live in `contracts` rather than `domain` so `apps/web` can share them with the server when
 * it edits links and renders the CV preview; `domain` re-exports everything here.
 *
 * The kind is stored rather than derived because a personal site and a portfolio cannot be told
 * apart by hostname. New kinds may be added; readers treat a kind they do not know as one inferred
 * from the URL, so adding one stays backwards compatible.
 */
export const PROFILE_LINK_KINDS = ["linkedin", "github", "website", "portfolio", "other"] as const;

export type ProfileLinkKind = (typeof PROFILE_LINK_KINDS)[number];

export interface ProfileLink {
  kind: ProfileLinkKind;
  url: string;
}

/** The most links a profile keeps, matching the API limit. */
export const MAX_PROFILE_LINKS = 10;

export const PROFILE_LINK_KIND_LABELS: Record<ProfileLinkKind, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  portfolio: "Portfolio",
  other: "Other",
};

export function isProfileLinkKind(value: unknown): value is ProfileLinkKind {
  return typeof value === "string" && (PROFILE_LINK_KINDS as readonly string[]).includes(value);
}

/** True for an absolute `http:` or `https:` URL, the only schemes a CV may link to. */
export function isHttpProfileLinkUrl(value: string): boolean {
  const url = parseUrl(value);
  return url !== undefined && (url.protocol === "http:" || url.protocol === "https:");
}

/** Suggests a kind from the hostname: LinkedIn, GitHub, or otherwise a website. */
export function inferProfileLinkKind(url: string): ProfileLinkKind {
  const hostname = parseUrl(url)?.hostname.toLowerCase() ?? "";
  if (hostMatches(hostname, "linkedin.com")) return "linkedin";
  if (hostMatches(hostname, "github.com")) return "github";
  return "website";
}

/**
 * Turns what a user typed or a CV printed into an absolute `http(s)` URL, adding `https://` when the
 * scheme is missing ("github.com/ada"). Returns undefined for empty input, text with spaces, email
 * addresses, other schemes such as `javascript:` or `mailto:`, and hosts without a dot.
 */
export function normalizeProfileLinkUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return undefined;
  const hasHttpScheme = /^https?:\/\//i.test(trimmed);
  // Any other explicit scheme ("javascript:", "mailto:", "ftp://") is refused rather than
  // prefixed. A digit after the colon is a port ("example.com:8080"), not a scheme.
  if (!hasHttpScheme && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed)) return undefined;
  const url = parseUrl(hasHttpScheme ? trimmed : `https://${trimmed}`);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return undefined;
  // "ada@example.com" parses as a user name on a host; it is an email address, not a link.
  if (url.username || url.password) return undefined;
  return url.hostname.includes(".") ? url.href : undefined;
}

/** Treats links that differ only in scheme, `www.`, case, or a trailing slash as the same link. */
export function profileLinkKey(url: string): string {
  const key = url
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "");
  return withoutTrailingSlashes(key);
}

/** The short, schemeless form a CV shows, such as `linkedin.com/in/ada`. */
export function formatProfileLinkLabel(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return url.trim();
  const host = parsed.host.replace(/^www\./i, "");
  const path = withoutTrailingSlashes(parsed.pathname);
  return `${host}${path}${parsed.search}${parsed.hash}`;
}

/**
 * Reads stored or submitted links: keeps `{ kind, url }` entries and legacy plain URL strings in
 * order, infers a missing or unknown kind from the URL, trims URLs, and drops entries that are not
 * `http(s)` URLs, repeats of an earlier link, and anything past the limit.
 */
export function normalizeProfileLinks(value: unknown): ProfileLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const links: ProfileLink[] = [];

  for (const item of value) {
    const rawUrl =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string"
          ? (item as { url: string }).url
          : undefined;
    const url = rawUrl?.trim();
    if (!url || !isHttpProfileLinkUrl(url)) continue;
    const key = profileLinkKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = typeof item === "object" ? (item as { kind?: unknown }).kind : undefined;
    links.push({ kind: isProfileLinkKind(kind) ? kind : inferProfileLinkKind(url), url });
    if (links.length === MAX_PROFILE_LINKS) break;
  }

  return links;
}

// A loop rather than /\/+$/, which rescans a long run of slashes from every position when the
// run does not reach the end of the string.
function withoutTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === "/") end -= 1;
  return text.slice(0, end);
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value.trim());
  } catch {
    return undefined;
  }
}

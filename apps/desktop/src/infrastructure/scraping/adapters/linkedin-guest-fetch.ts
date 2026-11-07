import type { ScrapingFailureCategory } from "@careerden/contracts";
import { ScrapingFailure } from "../../../domain/scraping/scraping-failure.js";

export const linkedInGuestFetchTimeoutMs = 30_000;

export interface LinkedInGuestPage {
  finalUrl: string;
  html: string;
}

export interface LinkedInParseFailureLog {
  adapter: "linkedin-company" | "linkedin-job";
  missing: string[];
  parserVersion: string;
  url: string;
}

export type LinkedInScraperLogger = Pick<Console, "warn">;

/**
 * Maps a LinkedIn guest response status to a failure category, or `undefined` for a usable
 * response. LinkedIn answers bots it distrusts with a non-standard 999.
 */
export function linkedInStatusToFailureCategory(
  status: number,
): ScrapingFailureCategory | undefined {
  if (status >= 200 && status < 300) return undefined;
  if (status === 404 || status === 410) return "not_found";
  if (status === 999 || status === 401 || status === 403) return "blocked";
  if (status === 429) return "rate_limited";
  return "unknown";
}

export async function fetchLinkedInGuestPage(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  timeoutMs = linkedInGuestFetchTimeoutMs,
): Promise<LinkedInGuestPage> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ScrapingFailure("network", errorDetail(error));
  }

  const category = linkedInStatusToFailureCategory(response.status);

  if (category) {
    throw new ScrapingFailure(
      category,
      `LinkedIn responded ${response.status} ${response.statusText}`.trim(),
    );
  }

  try {
    return { finalUrl: response.url || url, html: await response.text() };
  } catch (error) {
    throw new ScrapingFailure("network", errorDetail(error));
  }
}

/** Logs a page that loaded but did not match the parser, which usually means LinkedIn changed it. */
export function linkedInParseFailure(
  logger: LinkedInScraperLogger,
  entry: LinkedInParseFailureLog,
): ScrapingFailure {
  logger.warn("LinkedIn page did not match the expected structure", entry);
  return new ScrapingFailure("parse_failed", `Missing ${entry.missing.join(", ")}`);
}

function errorDetail(error: unknown): string | undefined {
  return error instanceof Error ? `${error.name}: ${error.message}` : undefined;
}

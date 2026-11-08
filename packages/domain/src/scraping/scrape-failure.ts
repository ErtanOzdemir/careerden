import type { ScrapeFailureCategory } from "@careerden/contracts";
import { formatScrapeFailureReason, parseScrapeFailureReason } from "@careerden/contracts";

/**
 * The category vocabulary and its reason-string codec live in `@careerden/contracts` so
 * `apps/web` can read a persisted failure without depending on this package. The rules that
 * decide which category a failure belongs to live here.
 */
export type { ScrapeFailureCategory, ScrapeFailureReason } from "@careerden/contracts";
export {
  formatScrapeFailureReason,
  parseScrapeFailureReason,
  scrapeFailureCategorySchema,
} from "@careerden/contracts";

/**
 * A scrape that failed for a known reason. Its message is the encoded failure reason, so the
 * category survives every boundary that only forwards `error.message`.
 */
export class ScrapeFailureError extends Error {
  constructor(
    public readonly category: ScrapeFailureCategory,
    public readonly detail: string,
  ) {
    super(formatScrapeFailureReason(category, detail));
    this.name = "ScrapeFailureError";
  }
}

/** Classifies an unsuccessful HTTP response from a job site. */
export function scrapeFailureCategoryForHttpStatus(status: number): ScrapeFailureCategory {
  if (status === 404 || status === 410) return "not_found";
  if (status === 429) return "rate_limited";
  // LinkedIn answers suspicious guest traffic with its non-standard 999.
  if (status === 401 || status === 403 || status === 999) return "blocked";
  if (status >= 500) return "network";
  return "unknown";
}

/**
 * Turns any scrape error into a categorized failure reason. Errors that already carry a category
 * keep it; anything else is reported as `unknown` so the reason is still recognized as a scrape
 * failure downstream.
 */
export function toScrapeFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown scraping error";

  if (parseScrapeFailureReason(message)) {
    return message;
  }

  return formatScrapeFailureReason(isNetworkError(error) ? "network" : "unknown", message);
}

function isNetworkError(error: unknown): boolean {
  // Node's fetch rejects with a TypeError("fetch failed") and aborts with an AbortError or a
  // TimeoutError; none of them reached the site's HTTP layer.
  return (
    error instanceof Error &&
    ((error.name === "TypeError" && error.message === "fetch failed") ||
      error.name === "AbortError" ||
      error.name === "TimeoutError")
  );
}

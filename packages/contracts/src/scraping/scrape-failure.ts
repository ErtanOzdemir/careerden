/**
 * LinkedIn throttles guest traffic per address and answers 429 while that window is open. A
 * throttled scrape means "not now" rather than a broken job URL, so the retry policy has to tell
 * the two apart: an ordinary failure retries within minutes, a throttled one has to wait out the
 * window instead of spending its attempts on more 429s.
 *
 * The signal travels inside the failure reason because scraping runs in a utility process and
 * reaches the API as a string: only `message` survives that boundary, and the same string is then
 * persisted and served to the renderer.
 */
export const scrapeRateLimitedReasonCode = "linkedin_rate_limited";

/** Builds a failure reason the retry policy and the renderer both recognize as throttling. */
export function createScrapeRateLimitedReason(detail: string): string {
  return `${scrapeRateLimitedReasonCode}: ${detail}`;
}

export function isScrapeRateLimitedReason(reason: string | undefined | null): boolean {
  return reason?.startsWith(`${scrapeRateLimitedReasonCode}:`) ?? false;
}

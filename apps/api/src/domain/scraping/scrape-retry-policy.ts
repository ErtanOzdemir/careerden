import type { ScrapingFailureCategory } from "@careerden/contracts";

export interface ScrapeRetryPolicy {
  /** Total scrape attempts, including the first one, before the application fails. */
  maxAttempts: number;
  /** Wait before the next automatic attempt, indexed by the attempt that just failed minus one. */
  backoffMs: readonly number[];
}

const defaultPolicy: ScrapeRetryPolicy = { maxAttempts: 3, backoffMs: [60_000, 300_000] };

// Retrying sooner keeps a guest block or rate limit in place, so these get one late retry.
const throttledPolicy: ScrapeRetryPolicy = { maxAttempts: 2, backoffMs: [15 * 60_000] };

// Retrying cannot fix a removed posting, a changed page, or a disabled importer.
const terminalPolicy: ScrapeRetryPolicy = { maxAttempts: 1, backoffMs: [] };

const policies: Record<ScrapingFailureCategory, ScrapeRetryPolicy> = {
  not_found: terminalPolicy,
  blocked: throttledPolicy,
  rate_limited: throttledPolicy,
  parse_failed: terminalPolicy,
  network: defaultPolicy,
  disabled: terminalPolicy,
  unknown: defaultPolicy,
};

export function scrapeRetryPolicyFor(category?: ScrapingFailureCategory): ScrapeRetryPolicy {
  return category ? policies[category] : defaultPolicy;
}

export function scrapeRetryBackoffMs(policy: ScrapeRetryPolicy, failedAttempt: number): number {
  return policy.backoffMs[failedAttempt - 1] ?? 0;
}

import type { ScrapeFailureCategory } from "@careerden/contracts";

export interface ScrapeRetryPolicy {
  /** Total scrape attempts, including the first one, before the application fails. */
  maxAttempts: number;
  /** Wait before the next automatic attempt, indexed by the attempt that just failed minus one. */
  backoffMs: readonly number[];
}

const defaultPolicy: ScrapeRetryPolicy = { maxAttempts: 3, backoffMs: [60_000, 300_000] };

// Retrying within minutes keeps a guest block or rate limit in place, so these get one late retry.
const throttledPolicy: ScrapeRetryPolicy = { maxAttempts: 2, backoffMs: [15 * 60_000] };

// Retrying cannot bring back a removed posting or a description LinkedIn does not expose, fix a
// changed page layout, or re-enable a disabled importer.
const terminalPolicy: ScrapeRetryPolicy = { maxAttempts: 1, backoffMs: [] };

const policies: Record<ScrapeFailureCategory, ScrapeRetryPolicy> = {
  blocked: throttledPolicy,
  rate_limited: throttledPolicy,
  network: defaultPolicy,
  parse: terminalPolicy,
  empty_description: terminalPolicy,
  not_found: terminalPolicy,
  disabled: terminalPolicy,
  unknown: defaultPolicy,
};

/** Failures without a category, such as reasons stored before categories existed, retry as before. */
export function scrapeRetryPolicyFor(category?: ScrapeFailureCategory): ScrapeRetryPolicy {
  return category ? policies[category] : defaultPolicy;
}

export function scrapeRetryBackoffMs(policy: ScrapeRetryPolicy, failedAttempt: number): number {
  return policy.backoffMs[failedAttempt - 1] ?? 0;
}

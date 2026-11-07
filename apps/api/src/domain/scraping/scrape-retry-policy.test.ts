import { describe, expect, it } from "vitest";
import { scrapeRetryBackoffMs, scrapeRetryPolicyFor } from "./scrape-retry-policy.js";

describe("scrapeRetryPolicyFor", () => {
  it("keeps three attempts for uncategorized, network, and unknown failures", () => {
    for (const category of [undefined, "network", "unknown"] as const) {
      expect(scrapeRetryPolicyFor(category)).toEqual({
        maxAttempts: 3,
        backoffMs: [60_000, 300_000],
      });
    }
  });

  it("limits blocked and rate-limited failures to one late retry", () => {
    for (const category of ["blocked", "rate_limited"] as const) {
      const policy = scrapeRetryPolicyFor(category);

      expect(policy.maxAttempts).toBe(2);
      expect(scrapeRetryBackoffMs(policy, 1)).toBe(15 * 60_000);
    }
  });

  it("does not retry failures that another attempt cannot fix", () => {
    for (const category of ["not_found", "parse_failed", "disabled"] as const) {
      expect(scrapeRetryPolicyFor(category).maxAttempts).toBe(1);
    }
  });

  it("falls back to no wait past the configured backoff steps", () => {
    expect(scrapeRetryBackoffMs(scrapeRetryPolicyFor(), 3)).toBe(0);
  });
});

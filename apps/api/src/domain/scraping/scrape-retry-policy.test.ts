import { describe, expect, it } from "vitest";
import { scrapeRetryBackoffMs, scrapeRetryPolicyFor } from "./scrape-retry-policy.js";

describe("scrapeRetryPolicyFor", () => {
  it("retries uncategorized, network, and unknown failures within minutes", () => {
    for (const category of [undefined, "network", "unknown"] as const) {
      const policy = scrapeRetryPolicyFor(category);
      expect(policy.maxAttempts).toBe(3);
      expect(scrapeRetryBackoffMs(policy, 1)).toBe(60_000);
      expect(scrapeRetryBackoffMs(policy, 2)).toBe(300_000);
    }
  });

  it("gives blocked and rate-limited scrapes a single retry after the throttling window", () => {
    for (const category of ["blocked", "rate_limited"] as const) {
      const policy = scrapeRetryPolicyFor(category);
      expect(policy.maxAttempts).toBe(2);
      expect(scrapeRetryBackoffMs(policy, 1)).toBe(15 * 60_000);
    }
  });

  it("does not retry failures a retry cannot fix", () => {
    for (const category of ["parse", "empty_description", "not_found", "disabled"] as const) {
      expect(scrapeRetryPolicyFor(category).maxAttempts).toBe(1);
    }
  });
});

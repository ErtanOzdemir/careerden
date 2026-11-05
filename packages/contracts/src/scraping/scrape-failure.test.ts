import { describe, expect, it } from "vitest";
import {
  createScrapeRateLimitedReason,
  isScrapeRateLimitedReason,
  scrapeRateLimitedReasonCode,
} from "./scrape-failure.js";

describe("scrape rate-limited reasons", () => {
  it("keeps the detail readable behind the code", () => {
    const reason = createScrapeRateLimitedReason(
      "LinkedIn public fetch failed: 429 Too Many Requests",
    );

    expect(reason).toBe(
      `${scrapeRateLimitedReasonCode}: LinkedIn public fetch failed: 429 Too Many Requests`,
    );
    expect(isScrapeRateLimitedReason(reason)).toBe(true);
  });

  it("does not match other failures, including ones that merely mention the code", () => {
    expect(isScrapeRateLimitedReason("LinkedIn public fetch failed: 403 Forbidden")).toBe(false);
    expect(isScrapeRateLimitedReason(`mentions ${scrapeRateLimitedReasonCode}: inline`)).toBe(
      false,
    );
    expect(isScrapeRateLimitedReason(undefined)).toBe(false);
    expect(isScrapeRateLimitedReason(null)).toBe(false);
  });
});

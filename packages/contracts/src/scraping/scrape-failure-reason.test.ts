import { describe, expect, it } from "vitest";
import {
  formatScrapeFailureReason,
  parseScrapeFailureReason,
  scrapeFailureCategorySchema,
} from "./scrape-failure-reason.js";

describe("scrape failure reasons", () => {
  it("round-trips every category with its readable detail", () => {
    for (const category of scrapeFailureCategorySchema.options) {
      const reason = formatScrapeFailureReason(category, "LinkedIn answered 999");

      expect(parseScrapeFailureReason(reason)).toEqual({
        category,
        detail: "LinkedIn answered 999",
      });
    }
  });

  it("reads reason codes written before the shared categories", () => {
    expect(
      parseScrapeFailureReason(
        "linkedin_guest_company_unavailable: LinkedIn required authentication",
      ),
    ).toEqual({ category: "blocked", detail: "LinkedIn required authentication" });
    expect(
      parseScrapeFailureReason("linkedin_rate_limited: LinkedIn public fetch failed: 429"),
    ).toEqual({ category: "rate_limited", detail: "LinkedIn public fetch failed: 429" });
  });

  it("does not classify uncoded, unknown, or inline-mentioned reasons", () => {
    expect(parseScrapeFailureReason("LinkedIn public fetch failed: 403 Forbidden")).toBeUndefined();
    expect(parseScrapeFailureReason("scrape_exploded: boom")).toBeUndefined();
    expect(parseScrapeFailureReason("mentions scrape_blocked: inline")).toBeUndefined();
    expect(parseScrapeFailureReason(undefined)).toBeUndefined();
    expect(parseScrapeFailureReason(null)).toBeUndefined();
  });
});

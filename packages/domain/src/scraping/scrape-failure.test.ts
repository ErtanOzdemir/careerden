import { describe, expect, it } from "vitest";
import {
  parseScrapeFailureReason,
  ScrapeFailureError,
  scrapeFailureCategoryForHttpStatus,
  toScrapeFailureReason,
} from "./scrape-failure.js";

describe("scrapeFailureCategoryForHttpStatus", () => {
  it.each([
    [999, "blocked"],
    [403, "blocked"],
    [401, "blocked"],
    [429, "rate_limited"],
    [404, "not_found"],
    [410, "not_found"],
    [500, "network"],
    [503, "network"],
    [400, "unknown"],
  ] as const)("classifies HTTP %i as %s", (status, category) => {
    expect(scrapeFailureCategoryForHttpStatus(status)).toBe(category);
  });
});

describe("ScrapeFailureError", () => {
  it("encodes its category into the message that crosses process boundaries", () => {
    const error = new ScrapeFailureError("empty_description", "No description text");

    expect(error.category).toBe("empty_description");
    expect(parseScrapeFailureReason(error.message)).toEqual({
      category: "empty_description",
      detail: "No description text",
    });
  });
});

describe("toScrapeFailureReason", () => {
  it("keeps the category of an already classified failure", () => {
    expect(toScrapeFailureReason(new ScrapeFailureError("blocked", "LinkedIn answered 999"))).toBe(
      "scrape_blocked: LinkedIn answered 999",
    );
  });

  it("classifies a fetch that never reached the site as a network failure", () => {
    expect(toScrapeFailureReason(new TypeError("fetch failed"))).toBe(
      "scrape_network: fetch failed",
    );
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(parseScrapeFailureReason(toScrapeFailureReason(timeout))?.category).toBe("network");
  });

  it("reports anything else as an unknown scrape failure", () => {
    expect(toScrapeFailureReason(new Error("utility process exited"))).toBe(
      "scrape_unknown: utility process exited",
    );
    expect(toScrapeFailureReason("not an error")).toBe("scrape_unknown: Unknown scraping error");
  });
});

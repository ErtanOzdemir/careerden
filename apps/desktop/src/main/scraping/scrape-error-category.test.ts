import { describe, expect, it } from "vitest";
import { LinkedInHttpError } from "../../infrastructure/scraping/adapters/linkedin-http.error.js";
import { categorizeScrapeError } from "./scrape-error-category.js";

describe("categorizeScrapeError", () => {
  it.each([
    [new LinkedInHttpError("LinkedIn job was not found", 404), "not_found"],
    [new LinkedInHttpError("LinkedIn public fetch failed: 429", 429), "rate_limited"],
    [new LinkedInHttpError("LinkedIn public fetch failed: 999", 999), "blocked"],
    [new LinkedInHttpError("LinkedIn public fetch failed: 500", 500), "http_error"],
    [new TypeError("fetch failed"), "network"],
    [new Error("LinkedIn public job details were not exposed"), "extraction"],
    ["not an error", "extraction"],
  ])("categorizes %s as %s", (error, category) => {
    expect(categorizeScrapeError(error)).toBe(category);
  });
});

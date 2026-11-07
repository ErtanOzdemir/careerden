import { describe, expect, it, vi } from "vitest";
import { scrapingFailureGuidance } from "@careerden/contracts";
import { LinkedInCompanyScraper } from "./linkedin-company.scraper.js";
import {
  fetchLinkedInGuestPage,
  linkedInParseFailure,
  linkedInStatusToFailureCategory,
} from "./linkedin-guest-fetch.js";
import { LinkedInJobScraper } from "./linkedin-job.scraper.js";

const jobUrl = "https://www.linkedin.com/jobs/view/4300011451";

// `Response` rejects statuses outside 200-599, and LinkedIn answers with a non-standard 999.
function linkedInResponse(status: number, html = "", statusText = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => html,
    url: "",
  } as Response;
}

describe("linkedInStatusToFailureCategory", () => {
  it.each([
    [200, undefined],
    [204, undefined],
    [404, "not_found"],
    [410, "not_found"],
    [999, "blocked"],
    [403, "blocked"],
    [401, "blocked"],
    [429, "rate_limited"],
    [400, "unknown"],
    [500, "unknown"],
    [503, "unknown"],
  ] as const)("maps HTTP %i to %s", (status, category) => {
    expect(linkedInStatusToFailureCategory(status)).toBe(category);
  });
});

describe("fetchLinkedInGuestPage", () => {
  it("returns the page HTML and final URL for a successful response", async () => {
    const fetchImpl = vi.fn(async () => linkedInResponse(200, "<html></html>"));

    await expect(fetchLinkedInGuestPage(fetchImpl, jobUrl, {})).resolves.toEqual({
      finalUrl: jobUrl,
      html: "<html></html>",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      jobUrl,
      expect.objectContaining({ redirect: "follow", signal: expect.any(AbortSignal) }),
    );
  });

  it("throws a categorized failure with the user message for a non-standard 999", async () => {
    const fetchImpl = async () => linkedInResponse(999, "", "Request denied");

    await expect(fetchLinkedInGuestPage(fetchImpl, jobUrl, {})).rejects.toMatchObject({
      name: "ScrapingFailure",
      category: "blocked",
      message: scrapingFailureGuidance.blocked.message,
      detail: "LinkedIn responded 999 Request denied",
    });
  });

  it("maps a connection error to a network failure", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };

    await expect(fetchLinkedInGuestPage(fetchImpl, jobUrl, {})).rejects.toMatchObject({
      category: "network",
      message: "Check your internet connection.",
    });
  });

  it("maps a timeout to a network failure", async () => {
    const fetchImpl = (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    await expect(fetchLinkedInGuestPage(fetchImpl, jobUrl, {}, 5)).rejects.toMatchObject({
      category: "network",
    });
  });
});

describe("linkedInParseFailure", () => {
  it("logs the missing fields and returns a parse failure", () => {
    const logger = { warn: vi.fn() };
    const failure = linkedInParseFailure(logger, {
      adapter: "linkedin-job",
      missing: ["description"],
      parserVersion: "v1",
      url: jobUrl,
    });

    expect(failure.category).toBe("parse_failed");
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe("LinkedIn scrapers", () => {
  it.each([
    [404, "not_found"],
    [999, "blocked"],
    [403, "blocked"],
    [429, "rate_limited"],
    [502, "unknown"],
  ] as const)("map a job page HTTP %i to %s", async (status, category) => {
    const scraper = new LinkedInJobScraper({
      fetch: async () => linkedInResponse(status),
    });

    await expect(scraper.scrapeJob(jobUrl)).rejects.toMatchObject({ category });
  });

  it.each([
    [404, "not_found"],
    [999, "blocked"],
    [429, "rate_limited"],
  ] as const)("map a company page HTTP %i to %s", async (status, category) => {
    const scraper = new LinkedInCompanyScraper({
      fetch: async () => linkedInResponse(status),
    });

    await expect(
      scraper.scrapeCompany({
        companyName: "Acme",
        linkedInUrl: "https://www.linkedin.com/company/acme",
      }),
    ).rejects.toMatchObject({ category });
  });

  it("logs a company page that no longer exposes any expected field", async () => {
    const logger = { warn: vi.fn() };
    const scraper = new LinkedInCompanyScraper({
      fetch: async () => linkedInResponse(200, "<html><body>Nothing here</body></html>"),
      logger,
    });

    await expect(
      scraper.scrapeCompany({
        companyName: "Acme",
        linkedInUrl: "https://www.linkedin.com/company/acme",
      }),
    ).rejects.toMatchObject({ category: "parse_failed" });
    expect(logger.warn).toHaveBeenCalledWith(
      "LinkedIn page did not match the expected structure",
      expect.objectContaining({ adapter: "linkedin-company" }),
    );
  });

  it("treats a job URL without a LinkedIn job id as an unknown failure", async () => {
    const scraper = new LinkedInJobScraper({ fetch: vi.fn() });

    await expect(scraper.scrapeJob("https://www.linkedin.com/jobs/")).rejects.toMatchObject({
      category: "unknown",
    });
  });
});

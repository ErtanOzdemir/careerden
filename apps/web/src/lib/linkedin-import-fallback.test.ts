import { afterEach, describe, expect, it, vi } from "vitest";
import { formatScrapeFailureReason } from "@careerden/contracts";
import type { JobApplication } from "../types.js";
import {
  getLinkedInImportFailure,
  manualPastePrefillFromUrl,
  openManualPasteFlow,
  readOpenAddJobRequest,
  scrapeFailureDetail,
} from "./linkedin-import-fallback.js";

const sourceUrl = "https://www.linkedin.com/jobs/view/4300011451";

describe("getLinkedInImportFailure", () => {
  it("reports the category of a failed LinkedIn import", () => {
    expect(
      getLinkedInImportFailure(
        createApplication({
          processingStatus: "failed",
          processingFailureReason: formatScrapeFailureReason("blocked", "LinkedIn answered 999"),
        }),
      ),
    ).toEqual({ category: "blocked", retryScheduled: false });
  });

  it("treats an uncategorized or missing failure reason as unknown", () => {
    expect(
      getLinkedInImportFailure(
        createApplication({
          processingStatus: "failed",
          processingFailureReason: "LinkedIn public company fetch failed: 403 Forbidden",
        }),
      ),
    ).toEqual({ category: "unknown", retryScheduled: false });
    expect(getLinkedInImportFailure(createApplication({ processingStatus: "failed" }))).toEqual({
      category: "unknown",
      retryScheduled: false,
    });
  });

  it("offers the paste flow while a failed scrape waits for its retry", () => {
    expect(
      getLinkedInImportFailure(
        createApplication({
          processingStatus: "queued",
          processingFailureReason: formatScrapeFailureReason("rate_limited", "429"),
        }),
      ),
    ).toEqual({ category: "rate_limited", retryScheduled: true });
  });

  it("ignores imports that are waiting, succeeded, or were entered manually", () => {
    expect(getLinkedInImportFailure(createApplication({ processingStatus: "queued" }))).toBe(
      undefined,
    );
    expect(
      getLinkedInImportFailure(
        createApplication({ processingStatus: "failed", description: "Scraped text" }),
      ),
    ).toBeUndefined();
    expect(
      getLinkedInImportFailure(
        createApplication({ processingStatus: "failed", sourceUrl: undefined }),
      ),
    ).toBeUndefined();
  });
});

describe("manualPastePrefillFromUrl", () => {
  it("keeps the source link and reads role and company from a slugged URL", () => {
    expect(
      manualPastePrefillFromUrl(
        " https://www.linkedin.com/jobs/view/senior-backend-engineer-at-acme-corp-4300011451/ ",
      ),
    ).toEqual({
      jobUrl: "https://www.linkedin.com/jobs/view/senior-backend-engineer-at-acme-corp-4300011451/",
      roleTitle: "Senior Backend Engineer",
      companyName: "Acme Corp",
    });
  });

  it("keeps only the link when the URL carries no slug", () => {
    expect(manualPastePrefillFromUrl(sourceUrl)).toEqual({ jobUrl: sourceUrl });
    expect(manualPastePrefillFromUrl("not a url")).toEqual({ jobUrl: "not a url" });
  });
});

describe("openManualPasteFlow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks the shell to open the paste form prefilled with the LinkedIn URL", () => {
    const listener = vi.fn((event: Event) => readOpenAddJobRequest(event));
    window.addEventListener("careerden:open-add-job", listener);

    openManualPasteFlow(sourceUrl);

    window.removeEventListener("careerden:open-add-job", listener);
    expect(listener).toHaveReturnedWith({ method: "manual", prefill: { jobUrl: sourceUrl } });
  });

  it("reads a plain open-add-job event as no request", () => {
    expect(readOpenAddJobRequest(new CustomEvent("careerden:open-add-job"))).toBeUndefined();
  });
});

describe("scrapeFailureDetail", () => {
  it("strips the category code from a persisted reason", () => {
    expect(scrapeFailureDetail(formatScrapeFailureReason("network", "fetch failed"))).toBe(
      "fetch failed",
    );
    expect(scrapeFailureDetail("Plain reason")).toBe("Plain reason");
  });
});

function createApplication(overrides: Partial<JobApplication>): JobApplication {
  return {
    id: "job-1",
    company: "Unknown company",
    domain: "linkedin.com",
    role: "Untitled role",
    location: "Location not set",
    dateApplied: "Jan 1",
    dateLabel: "today",
    status: "Saved",
    tags: [],
    sourceUrl,
    ...overrides,
  } as JobApplication;
}

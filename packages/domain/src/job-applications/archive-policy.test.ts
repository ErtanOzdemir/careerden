import { describe, expect, it } from "vitest";
import { canArchiveJobApplication } from "./archive-policy.js";
import type { JobApplicationStatus } from "./workflow-status.js";

describe("job application archive policy", () => {
  it.each(["review_ready", "completed", "failed"] satisfies JobApplicationStatus[])(
    "allows stable %s applications",
    (status) => {
      expect(canArchiveJobApplication({ status, archivedAt: undefined })).toBe(true);
    },
  );

  it("allows scraped applications only when analysis is not queued", () => {
    expect(canArchiveJobApplication({ status: "scraped" })).toBe(true);
    expect(canArchiveJobApplication({ status: "scraped", analysisAttemptId: "attempt-1" })).toBe(
      false,
    );
  });

  it.each([
    "queued",
    "scraping",
    "analyzing",
    "generating_documents",
  ] satisfies JobApplicationStatus[])("rejects queued or running %s applications", (status) => {
    expect(canArchiveJobApplication({ status })).toBe(false);
  });
});

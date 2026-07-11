import { describe, expect, it, vi } from "vitest";
import { FailScrapeJobUseCase } from "./fail-scrape-job.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

describe("FailScrapeJobUseCase", () => {
  it("applies retry backoff and records a scheduled retry", async () => {
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const retry = createTestJobApplication({
      ...job,
      status: "queued",
      nextScrapeAttemptAt: new Date("2026-06-30T10:01:00.000Z"),
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => retry),
    });
    const now = new Date("2026-06-30T10:00:00.000Z");
    const publish = vi.fn();

    await expect(
      new FailScrapeJobUseCase(
        repository,
        createProfiles(),
        new JobApplicationChangeNotifier({ publish }),
      ).execute(job.id, "user-1", { claimedBy: "desktop-a", reason: "Session expired" }, now),
    ).resolves.toBe("retry_scheduled");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      reason: "Session expired",
      maxAttempts: 3,
      backoffMs: 60_000,
      now,
    });
    expect(publish).toHaveBeenCalledOnce();
  });

  it("rejects a failure report from another desktop claimant", async () => {
    const job = createTestJobApplication({ scrapeClaimedBy: "desktop-a" });
    const repository = createJobApplicationRepository({ findById: vi.fn(async () => job) });
    const publish = vi.fn();

    await expect(
      new FailScrapeJobUseCase(
        repository,
        createProfiles(),
        new JobApplicationChangeNotifier({ publish }),
      ).execute(job.id, "user-1", { claimedBy: "desktop-b", reason: "Failed" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(publish).not.toHaveBeenCalled();
  });
});

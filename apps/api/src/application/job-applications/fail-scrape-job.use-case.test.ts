import { describe, expect, it, vi } from "vitest";
import { FailScrapeJobUseCase } from "./fail-scrape-job.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "@careerden/application/testing";

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
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(
        job.id,
        "user-1",
        { claimedBy: "desktop-a", reason: "Session expired" },
        now,
      ),
    ).resolves.toBe("retry_scheduled");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      reason: "Session expired",
      maxAttempts: 3,
      backoffMs: 60_000,
      now,
    });
    expect(recordChanged).toHaveBeenCalledOnce();
  });

  it("persists the failure category and limits retries for a blocked scrape", async () => {
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const retry = createTestJobApplication({
      ...job,
      status: "queued",
      scrapeFailureCategory: "blocked",
      nextScrapeAttemptAt: new Date("2026-06-30T10:15:00.000Z"),
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => retry),
    });
    const now = new Date("2026-06-30T10:00:00.000Z");
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());

    await new FailScrapeJobUseCase(unitOfWork).execute(
      job.id,
      "user-1",
      { claimedBy: "desktop-a", reason: "LinkedIn is limiting access", category: "blocked" },
      now,
    );

    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      reason: "LinkedIn is limiting access",
      category: "blocked",
      maxAttempts: 2,
      backoffMs: 900_000,
      now,
    });
    expect(repository.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ scrapeFailureCategory: "blocked", maxAttempts: 2 }),
      }),
    );
  });

  it("fails a scrape for a removed posting without scheduling a retry", async () => {
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const failed = createTestJobApplication({
      ...job,
      status: "failed",
      scrapeFailureCategory: "not_found",
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => failed),
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(job.id, "user-1", {
        claimedBy: "desktop-a",
        reason: "This posting is no longer live.",
        category: "not_found",
      }),
    ).resolves.toBe("failed");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ category: "not_found", maxAttempts: 1, backoffMs: 0 }),
    );
  });

  it("rejects a failure report from another desktop claimant", async () => {
    const job = createTestJobApplication({ scrapeClaimedBy: "desktop-a" });
    const repository = createJobApplicationRepository({ findById: vi.fn(async () => job) });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(job.id, "user-1", {
        claimedBy: "desktop-b",
        reason: "Failed",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(recordChanged).not.toHaveBeenCalled();
  });
});

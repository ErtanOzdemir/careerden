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

  it("keeps the failure category on the application and shows the readable detail", async () => {
    const reason = "scrape_blocked: LinkedIn public fetch failed: 999 Request denied";
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 3,
    });
    const failed = createTestJobApplication({ ...job, status: "failed", failureReason: reason });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => failed),
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(job.id, "user-1", {
        claimedBy: "desktop-a",
        reason,
      }),
    ).resolves.toBe("failed");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ reason }),
    );
    expect(repository.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Scraping failed",
        body: "LinkedIn public fetch failed: 999 Request denied",
        metadata: expect.objectContaining({ scrapeFailureCategory: "blocked" }),
      }),
    );
  });

  it("waits out LinkedIn throttling with a single late retry", async () => {
    const reason = "scrape_rate_limited: LinkedIn public fetch failed: 429 Too Many Requests";
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const retry = createTestJobApplication({ ...job, status: "queued", failureReason: reason });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => retry),
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(job.id, "user-1", {
        claimedBy: "desktop-a",
        reason,
      }),
    ).resolves.toBe("retry_scheduled");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ maxAttempts: 2, backoffMs: 15 * 60_000 }),
    );
  });

  it("fails a removed posting on the first attempt", async () => {
    const reason = "scrape_not_found: LinkedIn job was not found";
    const job = createTestJobApplication({
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const failed = createTestJobApplication({ ...job, status: "failed", failureReason: reason });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => failed),
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());

    await expect(
      new FailScrapeJobUseCase(unitOfWork).execute(job.id, "user-1", {
        claimedBy: "desktop-a",
        reason,
      }),
    ).resolves.toBe("failed");
    expect(repository.recordScrapeFailure).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ maxAttempts: 1, backoffMs: 0 }),
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

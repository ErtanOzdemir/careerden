import { describe, expect, it, vi } from "vitest";
import type { RemoteImageFetcher } from "@link2cv/domain";
import {
  createJobApplicationRepository,
  createProfiles,
  createScrapeBundle,
  createStorage,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";
import { SubmitJobApplicationScrapeDataUseCase } from "./submit-job-application-scrape-data.use-case.js";

describe("SubmitJobApplicationScrapeDataUseCase", () => {
  it("persists scrape results, updates tracking, and returns the detail projection", async () => {
    const job = createTestJobApplication({ status: "scraping", scrapeClaimedBy: "desktop-a" });
    const repository = createJobApplicationRepository({ findById: vi.fn(async () => job) });
    const profiles = createProfiles();
    vi.mocked(profiles.findById).mockResolvedValue({ autoRunMatchAnalysis: true } as never);
    const detail = { ...job, documents: [] } as never;
    const getDetail = { execute: vi.fn(async () => detail) };
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, profiles);

    await expect(
      new SubmitJobApplicationScrapeDataUseCase(
        repository,
        profiles,
        unitOfWork,
        { fetch: vi.fn() } as RemoteImageFetcher,
        createStorage(),
        getDetail,
      ).execute(job.id, "user-1", {
        claimedBy: "desktop-a",
        scrapeBundle: createScrapeBundle(),
      }),
    ).resolves.toBe(detail);
    expect(repository.updateTracking).toHaveBeenCalledWith(job.id, {
      companyName: "Acme",
      roleTitle: "Backend Engineer",
    });
    expect(repository.updateStatus).toHaveBeenCalledWith(job.id, "scraped");
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.analysis-requested" }),
    );
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.change" }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { ClaimNextScrapeJobUseCase } from "./claim-next-scrape-job.use-case.js";
import {
  createJobApplicationRepository,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

describe("ClaimNextScrapeJobUseCase", () => {
  it("claims work for the current profile and records the start event", async () => {
    const job = createTestJobApplication({ status: "scraping" });
    const repository = createJobApplicationRepository({
      claimNextScrapeJob: vi.fn(async () => job),
    });
    const currentProfile = { execute: vi.fn(async () => ({ id: "profile-1" }) as never) };
    const publish = vi.fn();

    await expect(
      new ClaimNextScrapeJobUseCase(
        repository,
        currentProfile,
        new JobApplicationChangeNotifier({ publish }),
      ).execute({ id: "user-1", name: "Ada", email: "ada@example.com" }, "desktop-a"),
    ).resolves.toBe(job);
    expect(repository.claimNextScrapeJob).toHaveBeenCalledWith({
      profileId: "profile-1",
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
    });
    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "Scraping started",
    });
    expect(publish).toHaveBeenCalledOnce();
  });
});

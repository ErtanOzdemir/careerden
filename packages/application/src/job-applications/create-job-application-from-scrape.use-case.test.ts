import { describe, expect, it, vi } from "vitest";
import { CreateJobApplicationFromScrapeUseCase } from "./create-job-application-from-scrape.use-case.js";
import {
  createJobApplicationRepository,
  createQueue,
  createScrapeBundle,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

describe("CreateJobApplicationFromScrapeUseCase", () => {
  it("persists desktop scrape data and enqueues enabled analysis", async () => {
    const job = createTestJobApplication({ status: "queued" });
    const repository = createJobApplicationRepository({ create: vi.fn(async () => job) });
    const currentProfile = {
      execute: vi.fn(async () => ({ id: "profile-1", autoRunMatchAnalysis: true }) as never),
    };
    const queue = createQueue();
    const publish = vi.fn();

    await new CreateJobApplicationFromScrapeUseCase(
      repository,
      currentProfile,
      queue,
      new JobApplicationChangeNotifier({ publish }),
    ).execute(
      { id: "user-1", name: "Ada", email: "ada@example.com" },
      { sourceUrl: "https://www.linkedin.com/jobs/view/1", scrapeBundle: createScrapeBundle() },
    );

    expect(repository.saveScrapeBundle).toHaveBeenCalledWith(job.id, createScrapeBundle());
    expect(repository.updateStatus).toHaveBeenCalledWith(job.id, "scraped");
    expect(queue.enqueue).toHaveBeenCalledWith({ jobApplicationId: job.id });
    expect(publish).toHaveBeenCalledOnce();
  });
});

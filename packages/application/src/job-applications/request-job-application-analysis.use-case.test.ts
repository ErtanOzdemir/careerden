import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createQueue,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { RequestJobApplicationAnalysisUseCase } from "./request-job-application-analysis.use-case.js";

describe("RequestJobApplicationAnalysisUseCase", () => {
  it("records and enqueues analysis for a scraped application", async () => {
    const job = createTestJobApplication({ status: "scraped" });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      getScrapeBundle: vi.fn(async () => ({ job: {} }) as never),
    });
    const queue = createQueue();

    await new RequestJobApplicationAnalysisUseCase(repository, createProfiles(), queue).execute(
      job.id,
      "user-1",
    );

    expect(queue.enqueue).toHaveBeenCalledWith({ jobApplicationId: job.id });
    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "AI analysis requested",
    });
  });
});

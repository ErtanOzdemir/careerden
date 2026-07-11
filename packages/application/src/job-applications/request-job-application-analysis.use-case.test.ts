import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";
import { RequestJobApplicationAnalysisUseCase } from "./request-job-application-analysis.use-case.js";

describe("RequestJobApplicationAnalysisUseCase", () => {
  it("records and enqueues analysis for a scraped application", async () => {
    const job = createTestJobApplication({ status: "scraped" });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      getScrapeBundle: vi.fn(async () => ({ job: {} }) as never),
    });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());

    await new RequestJobApplicationAnalysisUseCase(unitOfWork).execute(job.id, "user-1");

    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.analysis-requested" }),
    );
    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "AI analysis requested",
    });
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.change" }),
    );
  });
});

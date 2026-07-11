import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";
import { UpdateJobApplicationStatusUseCase } from "./update-job-application-status.use-case.js";

describe("UpdateJobApplicationStatusUseCase", () => {
  it("validates the transition and records the processing event", async () => {
    const initial = createTestJobApplication({ status: "queued" });
    const updated = createTestJobApplication({ status: "scraping" });
    const repository = createJobApplicationRepository({
      findById: vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated),
    });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());

    await expect(
      new UpdateJobApplicationStatusUseCase(unitOfWork).execute(initial.id, "user-1", "scraping"),
    ).resolves.toBe(updated);
    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: initial.id,
      type: "processing",
      title: "Scraping started",
    });
    expect(addOutboxEvent).toHaveBeenCalledOnce();
  });
});

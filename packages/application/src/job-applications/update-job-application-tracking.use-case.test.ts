import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";
import { UpdateJobApplicationTrackingUseCase } from "./update-job-application-tracking.use-case.js";

describe("UpdateJobApplicationTrackingUseCase", () => {
  it("records an event when the application status changes", async () => {
    const job = createTestJobApplication();
    const updated = createTestJobApplication({
      tracking: { ...job.tracking, applicationStatus: "interview" },
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      updateTracking: vi.fn(async () => updated),
    });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());

    await new UpdateJobApplicationTrackingUseCase(unitOfWork).execute(job.id, "user-1", {
      applicationStatus: "interview",
    });

    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "status_changed",
      title: "Status changed to interview",
      metadata: { from: "applied", to: "interview" },
    });
    expect(addOutboxEvent).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "@careerden/application/testing";
import { UpdateJobApplicationTrackingUseCase } from "./update-job-application-tracking.use-case.js";

describe("UpdateJobApplicationTrackingUseCase", () => {
  it("records an event when the application status changes and returns its id", async () => {
    const job = createTestJobApplication();
    const updated = createTestJobApplication({
      tracking: { ...job.tracking, applicationStatus: "interview" },
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      updateTracking: vi.fn(async () => updated),
      addEvent: vi.fn(async (input) => ({
        ...input,
        id: "event-1",
        metadata: input.metadata ?? {},
        occurredAt: new Date(),
        createdAt: new Date(),
      })),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    const result = await new UpdateJobApplicationTrackingUseCase(unitOfWork).execute(
      job.id,
      "user-1",
      { applicationStatus: "interview" },
    );

    expect(result.statusChangeId).toBe("event-1");

    expect(repository.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "status_changed",
      title: "Status changed to interview",
      metadata: { from: "applied", to: "interview" },
    });
    expect(recordChanged).toHaveBeenCalledOnce();
  });

  it("updates salary details without creating a status event", async () => {
    const job = createTestJobApplication();
    const updated = createTestJobApplication({
      tracking: {
        ...job.tracking,
        salaryMinAmount: 90_000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "gross",
      },
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      updateTracking: vi.fn(async () => updated),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    const result = await new UpdateJobApplicationTrackingUseCase(unitOfWork).execute(
      job.id,
      "user-1",
      {
        salaryMinAmount: 90_000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "gross",
      },
    );

    expect(repository.updateTracking).toHaveBeenCalledWith(job.id, {
      salaryMinAmount: 90_000,
      salaryCurrency: "EUR",
      salaryPeriod: "yearly",
      salaryType: "gross",
    });
    expect(repository.addEvent).not.toHaveBeenCalled();
    expect(recordChanged).toHaveBeenCalledOnce();
    expect(result.tracking.salaryCurrency).toBe("EUR");
  });

  it("updates interest without creating a status event", async () => {
    const job = createTestJobApplication();
    const updated = createTestJobApplication({
      tracking: { ...job.tracking, priority: "high" },
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      updateTracking: vi.fn(async () => updated),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    const result = await new UpdateJobApplicationTrackingUseCase(unitOfWork).execute(
      job.id,
      "user-1",
      { priority: "high" },
    );

    expect(repository.updateTracking).toHaveBeenCalledWith(job.id, { priority: "high" });
    expect(repository.addEvent).not.toHaveBeenCalled();
    expect(recordChanged).toHaveBeenCalledOnce();
    expect(result.tracking.priority).toBe("high");
  });

  it("updates work style without creating a status event", async () => {
    const job = createTestJobApplication();
    const updated = createTestJobApplication({
      tracking: { ...job.tracking, workStyle: "hybrid" },
    });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      updateTracking: vi.fn(async () => updated),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    const result = await new UpdateJobApplicationTrackingUseCase(unitOfWork).execute(
      job.id,
      "user-1",
      { workStyle: "hybrid" },
    );

    expect(repository.updateTracking).toHaveBeenCalledWith(job.id, { workStyle: "hybrid" });
    expect(repository.addEvent).not.toHaveBeenCalled();
    expect(recordChanged).toHaveBeenCalledOnce();
    expect(result.tracking.workStyle).toBe("hybrid");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "@careerden/application/testing";
import type { ApplicationStatus } from "@careerden/domain";
import { UndoJobApplicationStatusChangeUseCase } from "./undo-job-application-status-change.use-case.js";

function statusChange(from: ApplicationStatus, to: ApplicationStatus) {
  return {
    id: "event-1",
    jobApplicationId: "job-1",
    type: "status_changed" as const,
    title: `Status changed to ${to}`,
    occurredAt: new Date("2026-10-01T00:00:00.000Z"),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    metadata: { from, to },
  };
}

function setup(currentStatus: ApplicationStatus, removed: ReturnType<typeof statusChange> | null) {
  const job = createTestJobApplication({
    id: "job-1",
    tracking: { ...createTestJobApplication().tracking, applicationStatus: currentStatus },
  });
  const repository = createJobApplicationRepository({
    findById: vi.fn(async () => job),
    deleteLatestStatusChange: vi.fn(async () => removed),
    updateTracking: vi.fn(async (_id, input) =>
      createTestJobApplication({
        id: "job-1",
        tracking: { ...job.tracking, applicationStatus: input.applicationStatus ?? currentStatus },
      }),
    ),
  });
  return { repository, ...createUnitOfWork(repository, createProfiles()) };
}

describe("UndoJobApplicationStatusChangeUseCase", () => {
  it("restores the previous status and removes the change from the history", async () => {
    const { repository, unitOfWork, recordChanged } = setup(
      "interview",
      statusChange("applied", "interview"),
    );

    const result = await new UndoJobApplicationStatusChangeUseCase(unitOfWork).execute(
      "job-1",
      "event-1",
      "user-1",
    );

    expect(repository.deleteLatestStatusChange).toHaveBeenCalledWith("job-1", "event-1");
    expect(repository.updateTracking).toHaveBeenCalledWith("job-1", {
      applicationStatus: "applied",
    });
    expect(result.tracking.applicationStatus).toBe("applied");
    expect(recordChanged).toHaveBeenCalledOnce();
  });

  it("refuses once a newer status change exists", async () => {
    const { repository, unitOfWork } = setup("offer", null);

    await expect(
      new UndoJobApplicationStatusChangeUseCase(unitOfWork).execute("job-1", "event-1", "user-1"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repository.updateTracking).not.toHaveBeenCalled();
  });

  it("refuses when the current status no longer matches the change", async () => {
    const { repository, unitOfWork } = setup("offer", statusChange("applied", "interview"));

    await expect(
      new UndoJobApplicationStatusChangeUseCase(unitOfWork).execute("job-1", "event-1", "user-1"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repository.updateTracking).not.toHaveBeenCalled();
  });
});

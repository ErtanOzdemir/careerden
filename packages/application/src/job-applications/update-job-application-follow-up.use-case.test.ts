import { describe, expect, it, vi } from "vitest";
import type { JobApplicationFollowUp } from "@link2cv/domain";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";
import { UpdateJobApplicationFollowUpUseCase } from "./update-job-application-follow-up.use-case.js";

describe("UpdateJobApplicationFollowUpUseCase", () => {
  it("removes and replaces the reminder when rescheduled", async () => {
    const job = createTestJobApplication();
    const existing = createFollowUp({ reminderJobId: "old-reminder" });
    const updated = createFollowUp({ scheduledAt: new Date("2026-07-03T09:00:00.000Z") });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      findFollowUpById: vi.fn(async () => existing),
      updateFollowUp: vi.fn(async () => updated),
    });
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(
      repository,
      createProfiles(),
    );

    await new UpdateJobApplicationFollowUpUseCase(unitOfWork).execute(
      job.id,
      existing.id,
      "user-1",
      { scheduledAt: updated.scheduledAt },
    );

    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "follow-up-reminder.cancel" }),
    );
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "follow-up-reminder.schedule" }),
    );
    expect(repository.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow-up rescheduled: Send a note" }),
    );
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});

function createFollowUp(overrides: Partial<JobApplicationFollowUp> = {}): JobApplicationFollowUp {
  const now = new Date("2026-07-01T09:00:00.000Z");
  return {
    id: "follow-up-1",
    jobApplicationId: "job-1",
    profileId: "profile-1",
    title: "Send a note",
    scheduledAt: new Date("2026-07-02T09:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

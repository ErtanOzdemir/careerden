import { describe, expect, it, vi } from "vitest";
import type { JobApplicationFollowUp } from "@careerden/domain";
import { CreateJobApplicationFollowUpUseCase } from "./create-job-application-follow-up.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";

describe("CreateJobApplicationFollowUpUseCase", () => {
  it("persists the follow-up, schedules its reminder, and records an event", async () => {
    const job = createTestJobApplication();
    const followUp = createFollowUp();
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      createFollowUp: vi.fn(async () => followUp),
    });
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(
      repository,
      createProfiles(),
    );

    await new CreateJobApplicationFollowUpUseCase(unitOfWork).execute(job.id, "user-1", {
      title: followUp.title,
      scheduledAt: followUp.scheduledAt,
    });

    const scheduledFor = new Date(followUp.scheduledAt.getTime() - 10 * 60 * 1000);
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "follow-up-reminder.schedule",
        payload: expect.objectContaining({
          followUpId: followUp.id,
          scheduledFor: scheduledFor.toISOString(),
        }),
      }),
    );
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});

function createFollowUp(): JobApplicationFollowUp {
  const now = new Date("2026-07-01T09:00:00.000Z");
  return {
    id: "follow-up-1",
    jobApplicationId: "job-1",
    profileId: "profile-1",
    title: "Send a note",
    scheduledAt: new Date("2026-07-02T09:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  };
}

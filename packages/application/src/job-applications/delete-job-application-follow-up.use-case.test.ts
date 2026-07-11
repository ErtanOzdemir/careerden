import { describe, expect, it, vi } from "vitest";
import type { FollowUpReminderQueue, JobApplicationFollowUp } from "@link2cv/domain";
import { DeleteJobApplicationFollowUpUseCase } from "./delete-job-application-follow-up.use-case.js";
import {
  createJobApplicationChanges,
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";

describe("DeleteJobApplicationFollowUpUseCase", () => {
  it("removes the reminder, deletes the follow-up, and publishes the change", async () => {
    const job = createTestJobApplication();
    const followUp = {
      id: "follow-up-1",
      jobApplicationId: job.id,
      profileId: job.profileId,
      reminderJobId: "reminder-1",
    } as JobApplicationFollowUp;
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      findFollowUpById: vi.fn(async () => followUp),
      deleteFollowUp: vi.fn(),
    });
    const queue = { remove: vi.fn() } as unknown as FollowUpReminderQueue;
    const { changes, publish } = createJobApplicationChanges();

    await new DeleteJobApplicationFollowUpUseCase(
      repository,
      createProfiles(),
      queue,
      changes,
    ).execute(job.id, followUp.id, "user-1");

    expect(queue.remove).toHaveBeenCalledWith("reminder-1");
    expect(repository.deleteFollowUp).toHaveBeenCalledWith(followUp.id);
    expect(publish).toHaveBeenCalledOnce();
  });
});

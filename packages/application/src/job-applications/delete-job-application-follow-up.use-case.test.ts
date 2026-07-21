import { describe, expect, it, vi } from "vitest";
import type { JobApplicationFollowUp } from "@careerden/domain";
import { DeleteJobApplicationFollowUpUseCase } from "./delete-job-application-follow-up.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
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
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(
      repository,
      createProfiles(),
    );

    await new DeleteJobApplicationFollowUpUseCase(unitOfWork).execute(
      job.id,
      followUp.id,
      "user-1",
    );

    expect(repository.deleteFollowUp).toHaveBeenCalledWith(followUp.id);
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "follow-up-reminder.cancel" }),
    );
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});

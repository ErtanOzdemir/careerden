import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  JobApplicationFollowUp,
} from "@link2cv/domain";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
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
    const queue = {
      enqueue: vi.fn(async () => ({ jobId: "new-reminder" })),
      remove: vi.fn(),
      close: vi.fn(),
    } satisfies FollowUpReminderQueue;
    const reminders = { setSchedule: vi.fn() } as unknown as FollowUpReminderRepository;

    await new UpdateJobApplicationFollowUpUseCase(
      repository,
      createProfiles(),
      queue,
      reminders,
    ).execute(job.id, existing.id, "user-1", { scheduledAt: updated.scheduledAt });

    expect(queue.remove).toHaveBeenCalledWith("old-reminder");
    expect(queue.enqueue).toHaveBeenCalled();
    expect(repository.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow-up rescheduled: Send a note" }),
    );
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

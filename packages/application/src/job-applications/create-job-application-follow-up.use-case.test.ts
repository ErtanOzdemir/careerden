import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  JobApplicationFollowUp,
} from "@link2cv/domain";
import { CreateJobApplicationFollowUpUseCase } from "./create-job-application-follow-up.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";

describe("CreateJobApplicationFollowUpUseCase", () => {
  it("persists the follow-up, schedules its reminder, and records an event", async () => {
    const job = createTestJobApplication();
    const followUp = createFollowUp();
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      createFollowUp: vi.fn(async () => followUp),
    });
    const queue = createReminderQueue();
    const reminders = createReminderRepository();

    await new CreateJobApplicationFollowUpUseCase(
      repository,
      createProfiles(),
      queue,
      reminders,
    ).execute(job.id, "user-1", {
      title: followUp.title,
      scheduledAt: followUp.scheduledAt,
    });

    const scheduledFor = new Date(followUp.scheduledAt.getTime() - 10 * 60 * 1000);
    expect(queue.enqueue).toHaveBeenCalledWith({
      followUpId: followUp.id,
      jobApplicationId: job.id,
      profileId: job.profileId,
      followUpAt: followUp.scheduledAt,
      scheduledFor,
    });
    expect(reminders.setSchedule).toHaveBeenCalledWith(followUp.id, {
      jobId: "reminder-1",
      scheduledFor,
    });
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

function createReminderQueue(): FollowUpReminderQueue {
  return { enqueue: vi.fn(async () => ({ jobId: "reminder-1" })), remove: vi.fn(), close: vi.fn() };
}

function createReminderRepository(): FollowUpReminderRepository {
  return { setSchedule: vi.fn() } as unknown as FollowUpReminderRepository;
}

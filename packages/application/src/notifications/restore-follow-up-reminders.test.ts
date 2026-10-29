import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderCandidate,
  FollowUpReminderQueue,
  FollowUpReminderRepository,
} from "@careerden/domain";
import { getFollowUpReminderScheduledFor } from "@careerden/domain";
import {
  followUpReminderCatchUpWindowMs,
  restoreFollowUpReminders,
} from "./restore-follow-up-reminders.js";

const now = new Date("2026-10-29T10:00:00.000Z");

describe("restoreFollowUpReminders", () => {
  it("looks back over the catch-up window for undelivered reminders", async () => {
    const reminders = createReminderRepository([]);

    await restoreFollowUpReminders(reminders, createReminderQueue(), now);

    expect(reminders.listUndeliveredSince).toHaveBeenCalledWith(
      new Date(now.getTime() - followUpReminderCatchUpWindowMs),
    );
  });

  it("re-enqueues already scheduled and missed reminders and records their schedule", async () => {
    const future = candidate("follow-up-1", new Date("2026-11-02T09:00:00.000Z"), {
      reminderJobId: "follow-up-follow-up-1",
    });
    const missed = candidate("follow-up-2", new Date("2026-10-27T09:00:00.000Z"));
    const reminders = createReminderRepository([missed, future]);
    const queue = createReminderQueue();

    await expect(restoreFollowUpReminders(reminders, queue, now)).resolves.toBe(2);

    expect(queue.enqueue).toHaveBeenCalledWith({
      followUpId: "follow-up-2",
      jobApplicationId: "application-1",
      profileId: "profile-1",
      followUpAt: missed.scheduledAt,
      scheduledFor: getFollowUpReminderScheduledFor(missed.scheduledAt),
    });
    expect(reminders.setSchedule).toHaveBeenCalledWith("follow-up-1", {
      jobId: "follow-up-follow-up-1",
      scheduledFor: getFollowUpReminderScheduledFor(future.scheduledAt),
    });
    expect(reminders.setSchedule).toHaveBeenCalledTimes(2);
  });
});

function candidate(
  followUpId: string,
  scheduledAt: Date,
  overrides: Partial<FollowUpReminderCandidate> = {},
): FollowUpReminderCandidate {
  return {
    followUpId,
    jobApplicationId: "application-1",
    profileId: "profile-1",
    profileEmail: "ada@example.com",
    title: "Follow up",
    scheduledAt,
    ...overrides,
  };
}

function createReminderRepository(pending: FollowUpReminderCandidate[]) {
  return {
    clearSchedule: vi.fn(),
    findValidReminder: vi.fn(),
    listPendingForRecovery: vi.fn().mockResolvedValue([]),
    listUndeliveredSince: vi.fn().mockResolvedValue(pending),
    markSent: vi.fn(),
    isPendingScheduleCurrent: vi.fn().mockResolvedValue(true),
    setSchedule: vi.fn(),
  } satisfies FollowUpReminderRepository;
}

function createReminderQueue() {
  return {
    close: vi.fn(),
    enqueue: vi.fn(async (input: { followUpId: string }) => ({
      jobId: `follow-up-${input.followUpId}`,
    })),
    remove: vi.fn(),
  } satisfies FollowUpReminderQueue;
}

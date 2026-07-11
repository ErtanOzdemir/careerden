import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  OutboxEvent,
} from "@link2cv/domain";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresReminderOutboxDispatcher } from "./postgres-reminder-outbox.dispatcher.js";

describe("PostgresReminderOutboxDispatcher", () => {
  it("replaces the deterministic delayed job and records its schedule", async () => {
    const outbox = createOutbox(scheduleEvent);
    const reminders = createReminders();
    const queue = createQueue();

    await new PostgresReminderOutboxDispatcher(outbox, reminders, queue).dispatchPending();

    expect(queue.remove).toHaveBeenCalledWith("follow-up-follow-up-1");
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        followUpId: "follow-up-1",
        scheduledFor: new Date("2026-07-02T08:50:00.000Z"),
      }),
    );
    expect(reminders.setSchedule).toHaveBeenCalledWith("follow-up-1", {
      jobId: "follow-up-follow-up-1",
      scheduledFor: new Date("2026-07-02T08:50:00.000Z"),
    });
    expect(outbox.markProcessed).toHaveBeenCalled();
  });

  it("drops a stale schedule without enqueueing it", async () => {
    const outbox = createOutbox(scheduleEvent);
    const reminders = createReminders({ isPendingScheduleCurrent: vi.fn(async () => false) });
    const queue = createQueue();

    await new PostgresReminderOutboxDispatcher(outbox, reminders, queue).dispatchPending();

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(outbox.markProcessed).toHaveBeenCalled();
  });
});

const scheduleEvent: OutboxEvent = {
  id: "event-1",
  type: "follow-up-reminder.schedule",
  aggregateId: "follow-up-1",
  payload: {
    followUpId: "follow-up-1",
    jobApplicationId: "job-1",
    profileId: "profile-1",
    followUpAt: "2026-07-02T09:00:00.000Z",
    scheduledFor: "2026-07-02T08:50:00.000Z",
  },
  attemptCount: 1,
};

function createOutbox(event: OutboxEvent): PostgresOutboxRepository {
  return {
    claimPending: vi.fn(async (input: { leaseOwner: string }) => [
      { ...event, leaseOwner: input.leaseOwner },
    ]),
    markProcessed: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
  } as unknown as PostgresOutboxRepository;
}

function createReminders(
  overrides: Partial<FollowUpReminderRepository> = {},
): FollowUpReminderRepository {
  return {
    clearSchedule: vi.fn(),
    findValidReminder: vi.fn(),
    isPendingScheduleCurrent: vi.fn(async () => true),
    listPendingForRecovery: vi.fn(async () => []),
    markSent: vi.fn(),
    setSchedule: vi.fn(),
    ...overrides,
  };
}

function createQueue(): FollowUpReminderQueue {
  return {
    enqueue: vi.fn(async (input) => ({ jobId: `follow-up-${input.followUpId}` })),
    remove: vi.fn(),
    close: vi.fn(),
  };
}

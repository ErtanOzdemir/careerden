import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  NotificationRepository,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { InMemoryNotificationRepository } from "@careerden/infrastructure";
import { DeliverFollowUpReminderUseCase } from "./deliver-follow-up-reminder.use-case.js";

describe("DeliverFollowUpReminderUseCase", () => {
  it("atomically marks the reminder sent and creates one notification", async () => {
    const reminders = createReminders();
    const notifications = new InMemoryNotificationRepository();
    const notificationChanges = { created: vi.fn(async () => undefined) };
    const useCase = new DeliverFollowUpReminderUseCase(
      reminders,
      createUnitOfWork(reminders, notifications, notificationChanges),
    );

    const delivered = await useCase.execute(payload);

    expect(delivered).toMatchObject({ title: "Send a note" });
    expect(reminders.markSent).toHaveBeenCalledWith(payload, expect.any(Date));
    const stored = await notifications.listByProfileId("profile-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      profileId: "profile-1",
      body: "It is time to follow up on Acme - Engineer.\n\nAsk about next steps",
    });
    expect(delivered).toEqual(stored[0]);
    expect(notificationChanges.created).toHaveBeenCalledWith(
      stored[0],
      "It is time to follow up on Acme - Engineer.",
    );
  });

  it("does not create a duplicate notification when the reminder was already claimed", async () => {
    const reminders = createReminders({ markSent: vi.fn(async () => false) });
    const notifications = new InMemoryNotificationRepository();
    const notificationChanges = { created: vi.fn(async () => undefined) };
    const useCase = new DeliverFollowUpReminderUseCase(
      reminders,
      createUnitOfWork(reminders, notifications, notificationChanges),
    );

    await expect(useCase.execute(payload)).resolves.toBeNull();
    expect(await notifications.listByProfileId("profile-1")).toEqual([]);
    expect(notificationChanges.created).not.toHaveBeenCalled();
  });
});

const payload: FollowUpReminderQueuePayload = {
  followUpId: "follow-up-1",
  jobApplicationId: "job-1",
  profileId: "profile-1",
  followUpAt: "2026-07-02T09:00:00.000Z",
  scheduledFor: "2026-07-02T08:50:00.000Z",
};

function createReminders(
  overrides: Partial<FollowUpReminderRepository> = {},
): FollowUpReminderRepository {
  return {
    clearSchedule: vi.fn(),
    findValidReminder: vi.fn(async () => ({
      followUpId: "follow-up-1",
      jobApplicationId: "job-1",
      profileId: "profile-1",
      profileEmail: "ada@example.com",
      companyName: "Acme",
      roleTitle: "Engineer",
      title: "Send a note",
      description: "Ask about next steps",
      scheduledAt: new Date(payload.followUpAt),
    })),
    isPendingScheduleCurrent: vi.fn(async () => true),
    listPendingForRecovery: vi.fn(async () => []),
    listUndeliveredSince: vi.fn(async () => []),
    markSent: vi.fn(async () => true),
    setSchedule: vi.fn(),
    ...overrides,
  };
}

function createUnitOfWork(
  reminders: FollowUpReminderRepository,
  notifications: NotificationRepository,
  notificationChanges: { created: ReturnType<typeof vi.fn> },
): PersistenceUnitOfWork {
  return {
    execute: async (work) =>
      work({
        billingSubscriptions: {} as never,
        credits: {} as never,
        jobApplications: {} as never,
        jobApplicationChanges: {} as never,
        profiles: {} as never,
        notifications,
        notificationChanges,
        followUpReminders: reminders,
        outbox: {
          add: vi.fn(async (input) => ({
            ...input,
            id: "outbox-1",
            attemptCount: 0,
            createdAt: new Date(),
          })),
        },
      }),
  };
}

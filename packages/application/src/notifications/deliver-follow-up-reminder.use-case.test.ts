import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  NotificationRepository,
  PersistenceUnitOfWork,
} from "@link2cv/domain";
import { DeliverFollowUpReminderUseCase } from "./deliver-follow-up-reminder.use-case.js";

describe("DeliverFollowUpReminderUseCase", () => {
  it("atomically marks the reminder sent and creates one notification", async () => {
    const reminders = createReminders();
    const notifications = createNotifications();
    const notificationChanges = { created: vi.fn(async () => undefined) };
    const useCase = new DeliverFollowUpReminderUseCase(
      reminders,
      createUnitOfWork(reminders, notifications, notificationChanges),
    );

    await expect(useCase.execute(payload)).resolves.toMatchObject({ title: "Send a note" });
    expect(reminders.markSent).toHaveBeenCalledWith(payload, expect.any(Date));
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "profile-1",
        body: "It is time to follow up on Acme - Engineer.\n\nAsk about next steps",
      }),
    );
    expect(notificationChanges.created).toHaveBeenCalledWith(
      expect.objectContaining({ id: "notification-1" }),
      "It is time to follow up on Acme - Engineer.",
    );
  });

  it("does not create a duplicate notification when the reminder was already claimed", async () => {
    const reminders = createReminders({ markSent: vi.fn(async () => false) });
    const notifications = createNotifications();
    const notificationChanges = { created: vi.fn(async () => undefined) };
    const useCase = new DeliverFollowUpReminderUseCase(
      reminders,
      createUnitOfWork(reminders, notifications, notificationChanges),
    );

    await expect(useCase.execute(payload)).resolves.toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
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
    markSent: vi.fn(async () => true),
    setSchedule: vi.fn(),
    ...overrides,
  };
}

function createNotifications(): NotificationRepository {
  return {
    create: vi.fn(async (input) => ({
      ...input,
      id: "notification-1",
      createdAt: new Date(),
    })),
  } as NotificationRepository;
}

function createUnitOfWork(
  reminders: FollowUpReminderRepository,
  notifications: NotificationRepository,
  notificationChanges: { created: ReturnType<typeof vi.fn> },
): PersistenceUnitOfWork {
  return {
    execute: async (work) =>
      work({
        jobApplications: {} as never,
        jobApplicationChanges: {} as never,
        profiles: {} as never,
        notifications,
        notificationChanges,
        followUpReminders: reminders,
        outbox: {
          add: vi.fn(async (input) => ({ ...input, id: "outbox-1", attemptCount: 0 })),
        },
      }),
  };
}

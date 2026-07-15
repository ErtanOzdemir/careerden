import { describe, expect, it, vi } from "vitest";
import type {
  EmailSender,
  FollowUpReminderCandidate,
  FollowUpReminderQueue,
  FollowUpReminderRepository,
} from "@link2cv/domain";
import { PostgresEmailOutboxDispatcher, PostgresOutboxRepository } from "@link2cv/infrastructure";
import { createEmailOutboxDispatcher, createFollowUpReminderRecoveryRunner } from "./app.js";

describe("createEmailOutboxDispatcher", () => {
  const outbox = new PostgresOutboxRepository({} as never);
  const emailSender: EmailSender = { send: vi.fn() };

  it("creates email delivery when reminder email is enabled", () => {
    expect(createEmailOutboxDispatcher(true, outbox, emailSender)).toBeInstanceOf(
      PostgresEmailOutboxDispatcher,
    );
  });

  it("omits email delivery when reminder email is disabled", () => {
    expect(createEmailOutboxDispatcher(false, outbox, emailSender)).toBeUndefined();
  });
});

describe("createFollowUpReminderRecoveryRunner", () => {
  it("skips overlapping recovery runs", async () => {
    let releaseRecovery!: () => void;
    const reminders = createReminderRepository({
      listPendingForRecovery: vi.fn(
        () =>
          new Promise<FollowUpReminderCandidate[]>((resolve) => {
            releaseRecovery = () => resolve([]);
          }),
      ),
    });
    const reminderQueue = createReminderQueue();
    const recover = createFollowUpReminderRecoveryRunner(
      reminders,
      reminderQueue,
      () => new Date("2026-07-09T12:00:00.000Z"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const firstRun = recover();
    await Promise.resolve();
    await recover();
    releaseRecovery();
    await firstRun;

    expect(reminders.listPendingForRecovery).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "Notifications worker skipped follow-up reminder recovery; already running",
    );

    warn.mockRestore();
  });

  it("resets the overlap guard after recovery failure", async () => {
    const reminders = createReminderRepository({
      listPendingForRecovery: vi
        .fn()
        .mockRejectedValueOnce(new Error("database unavailable"))
        .mockResolvedValueOnce([]),
    });
    const reminderQueue = createReminderQueue();
    const recover = createFollowUpReminderRecoveryRunner(
      reminders,
      reminderQueue,
      () => new Date("2026-07-09T12:00:00.000Z"),
    );

    await expect(recover()).rejects.toThrow("database unavailable");
    await expect(recover()).resolves.toBeUndefined();

    expect(reminders.listPendingForRecovery).toHaveBeenCalledTimes(2);
  });
});

function createReminderRepository(
  overrides: Partial<FollowUpReminderRepository> = {},
): FollowUpReminderRepository {
  return {
    clearSchedule: vi.fn(),
    findValidReminder: vi.fn(),
    listPendingForRecovery: vi.fn().mockResolvedValue([]),
    markSent: vi.fn(),
    isPendingScheduleCurrent: vi.fn().mockResolvedValue(true),
    setSchedule: vi.fn(),
    ...overrides,
  };
}

function createReminderQueue(
  overrides: Partial<FollowUpReminderQueue> = {},
): FollowUpReminderQueue {
  return {
    close: vi.fn(),
    enqueue: vi.fn().mockResolvedValue({ jobId: "follow-up-1" }),
    remove: vi.fn(),
    ...overrides,
  };
}

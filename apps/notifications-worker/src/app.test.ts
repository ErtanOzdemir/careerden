import { describe, expect, it, vi } from "vitest";
import type {
  FollowUpReminderCandidate,
  FollowUpReminderQueue,
  FollowUpReminderRepository,
} from "@link2cv/domain";
import { createFollowUpReminderRecoveryRunner } from "./app.js";

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

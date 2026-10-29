import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InProcessFollowUpReminderQueue } from "./in-process-follow-up-reminder.queue.js";

const start = new Date("2026-10-29T10:00:00.000Z");

function reminder(scheduledFor: Date) {
  return {
    followUpId: "follow-up-1",
    jobApplicationId: "application-1",
    profileId: "profile-1",
    followUpAt: new Date(scheduledFor.getTime() + 10 * 60_000),
    scheduledFor,
  };
}

describe("InProcessFollowUpReminderQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });

  afterEach(() => vi.useRealTimers());

  it("delivers the reminder payload when it is due", async () => {
    const deliver = vi.fn(async () => undefined);
    const queue = new InProcessFollowUpReminderQueue({ deliver });
    const input = reminder(new Date(start.getTime() + 60_000));

    await expect(queue.enqueue(input)).resolves.toEqual({ jobId: "follow-up-follow-up-1" });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(deliver).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(deliver).toHaveBeenCalledWith({
      followUpId: "follow-up-1",
      jobApplicationId: "application-1",
      profileId: "profile-1",
      followUpAt: input.followUpAt.toISOString(),
      scheduledFor: input.scheduledFor.toISOString(),
    });
  });

  it("waits past the native timer limit for distant reminders", async () => {
    const deliver = vi.fn(async () => undefined);
    const queue = new InProcessFollowUpReminderQueue({ deliver });
    const sixtyDaysMs = 60 * 24 * 60 * 60_000;

    await queue.enqueue(reminder(new Date(start.getTime() + sixtyDaysMs)));
    await vi.advanceTimersByTimeAsync(sixtyDaysMs - 1);
    expect(deliver).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(deliver).toHaveBeenCalledOnce();
  });

  it("replaces a scheduled reminder and cancels removed ones", async () => {
    const deliver = vi.fn(async () => undefined);
    const queue = new InProcessFollowUpReminderQueue({ deliver });

    await queue.enqueue(reminder(new Date(start.getTime() + 60_000)));
    await queue.enqueue(reminder(new Date(start.getTime() + 120_000)));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(deliver).not.toHaveBeenCalled();
    await queue.remove("follow-up-follow-up-1");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(deliver).not.toHaveBeenCalled();
  });

  it("retries failed deliveries with exponential backoff before giving up", async () => {
    const deliver = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const onFailed = vi.fn();
    const queue = new InProcessFollowUpReminderQueue({ deliver, onFailed });

    await queue.enqueue(reminder(start));
    await vi.advanceTimersByTimeAsync(0);
    expect(deliver).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(deliver).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deliver).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(deliver).toHaveBeenCalledTimes(3);
    expect(onFailed).toHaveBeenCalledWith(
      expect.objectContaining({ followUpId: "follow-up-1" }),
      expect.any(Error),
    );
  });

  it("stops every timer on close", async () => {
    const deliver = vi.fn(async () => undefined);
    const queue = new InProcessFollowUpReminderQueue({ deliver });

    await queue.enqueue(reminder(new Date(start.getTime() + 60_000)));
    await queue.close();
    await queue.enqueue(reminder(new Date(start.getTime() + 60_000)));
    await vi.advanceTimersByTimeAsync(120_000);

    expect(deliver).not.toHaveBeenCalled();
  });
});

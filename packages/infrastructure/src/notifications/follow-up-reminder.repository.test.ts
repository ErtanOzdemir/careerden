import { describe, expect, it } from "vitest";
import {
  getFollowUpReminderScheduledFor,
  shouldRecoverFollowUpReminder,
} from "./follow-up-reminder.repository.js";

describe("follow-up reminder recovery selection", () => {
  const now = new Date("2026-07-09T12:00:00.000Z");
  const scheduledAt = new Date("2026-07-09T13:00:00.000Z");
  const validScheduledFor = getFollowUpReminderScheduledFor(scheduledAt);

  it("recovers future reminders with missing queue metadata", () => {
    expect(
      shouldRecoverFollowUpReminder(
        {
          scheduledAt,
        },
        now,
      ),
    ).toBe(true);

    expect(
      shouldRecoverFollowUpReminder(
        {
          reminderJobId: "follow-up-1",
          scheduledAt,
        },
        now,
      ),
    ).toBe(true);
  });

  it("recovers future reminders with stale queue metadata", () => {
    expect(
      shouldRecoverFollowUpReminder(
        {
          reminderJobId: "follow-up-1",
          reminderScheduledFor: new Date("2026-07-09T12:45:00.000Z"),
          scheduledAt,
        },
        now,
      ),
    ).toBe(true);
  });

  it("skips reminders that are already sent, past due, or already scheduled correctly", () => {
    expect(
      shouldRecoverFollowUpReminder(
        {
          reminderSentAt: new Date("2026-07-09T11:00:00.000Z"),
          scheduledAt,
        },
        now,
      ),
    ).toBe(false);

    expect(
      shouldRecoverFollowUpReminder(
        {
          scheduledAt: new Date("2026-07-09T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe(false);

    expect(
      shouldRecoverFollowUpReminder(
        {
          reminderJobId: "follow-up-1",
          reminderScheduledFor: validScheduledFor,
          scheduledAt,
        },
        now,
      ),
    ).toBe(false);
  });
});

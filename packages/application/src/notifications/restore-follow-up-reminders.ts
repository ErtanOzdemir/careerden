import type { FollowUpReminderQueue, FollowUpReminderRepository } from "@careerden/domain";
import { getFollowUpReminderScheduledFor } from "@careerden/domain";

// Reminders missed while the app was closed still surface if their follow-up is this recent.
export const followUpReminderCatchUpWindowMs = 7 * 24 * 60 * 60 * 1000;

// Rebuilds every pending reminder in a queue that does not survive restarts. The database is the
// source of truth; reminders already due are delivered right away by the queue.
export async function restoreFollowUpReminders(
  reminders: FollowUpReminderRepository,
  reminderQueue: FollowUpReminderQueue,
  now: Date = new Date(),
): Promise<number> {
  const pending = await reminders.listUndeliveredSince(
    new Date(now.getTime() - followUpReminderCatchUpWindowMs),
  );

  for (const reminder of pending) {
    const scheduledFor = getFollowUpReminderScheduledFor(reminder.scheduledAt);
    const scheduled = await reminderQueue.enqueue({
      followUpId: reminder.followUpId,
      jobApplicationId: reminder.jobApplicationId,
      profileId: reminder.profileId,
      followUpAt: reminder.scheduledAt,
      scheduledFor,
    });

    await reminders.setSchedule(reminder.followUpId, {
      jobId: scheduled.jobId,
      scheduledFor,
    });
  }

  return pending.length;
}

import type { FollowUpReminderQueue, FollowUpReminderRepository } from "@careerden/domain";
import { getFollowUpReminderScheduledFor } from "@careerden/domain";

export function createFollowUpReminderRecoveryRunner(
  reminders: FollowUpReminderRepository,
  reminderQueue: FollowUpReminderQueue,
  now: () => Date = () => new Date(),
) {
  let isRecovering = false;

  return async function recoverFollowUpReminders(): Promise<void> {
    if (isRecovering) {
      console.warn("Skipped follow-up reminder recovery; already running");
      return;
    }

    isRecovering = true;
    try {
      await recoverPendingReminders(reminders, reminderQueue, now());
    } finally {
      isRecovering = false;
    }
  };
}

async function recoverPendingReminders(
  reminders: FollowUpReminderRepository,
  reminderQueue: FollowUpReminderQueue,
  now: Date,
) {
  const pending = await reminders.listPendingForRecovery(now);

  for (const reminder of pending) {
    const scheduledFor = getFollowUpReminderScheduledFor(reminder.scheduledAt);

    if (reminder.reminderJobId) {
      await reminderQueue.remove(reminder.reminderJobId).catch(() => {
        // The existing job may already be active or gone; re-adding below rebuilds delayed state.
      });
    }

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
}

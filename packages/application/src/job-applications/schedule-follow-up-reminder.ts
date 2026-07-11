import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  JobApplicationFollowUp,
} from "@link2cv/domain";
import { followUpReminderLeadTimeMs } from "@link2cv/domain";

export async function scheduleFollowUpReminder(input: {
  followUp: JobApplicationFollowUp;
  queue: FollowUpReminderQueue;
  reminders: FollowUpReminderRepository;
}): Promise<void> {
  const scheduledFor = new Date(input.followUp.scheduledAt.getTime() - followUpReminderLeadTimeMs);
  const scheduled = await input.queue.enqueue({
    followUpId: input.followUp.id,
    jobApplicationId: input.followUp.jobApplicationId,
    profileId: input.followUp.profileId,
    followUpAt: input.followUp.scheduledAt,
    scheduledFor,
  });
  await input.reminders.setSchedule(input.followUp.id, { jobId: scheduled.jobId, scheduledFor });
}

import type { JobApplicationFollowUp, OutboxRepository } from "@careerden/domain";
import { followUpReminderLeadTimeMs, outboxEventTypes } from "@careerden/domain";

export async function scheduleFollowUpReminder(input: {
  followUp: JobApplicationFollowUp;
  outbox: OutboxRepository;
}): Promise<void> {
  const scheduledFor = new Date(input.followUp.scheduledAt.getTime() - followUpReminderLeadTimeMs);
  await input.outbox.add({
    type: outboxEventTypes.followUpReminderSchedule,
    aggregateId: input.followUp.id,
    payload: {
      followUpId: input.followUp.id,
      jobApplicationId: input.followUp.jobApplicationId,
      profileId: input.followUp.profileId,
      followUpAt: input.followUp.scheduledAt.toISOString(),
      scheduledFor: scheduledFor.toISOString(),
    },
  });
}

export function cancelFollowUpReminder(
  outbox: OutboxRepository,
  followUpId: string,
): Promise<unknown> {
  return outbox.add({
    type: outboxEventTypes.followUpReminderCancel,
    aggregateId: followUpId,
    payload: { followUpId, jobId: `follow-up-${followUpId}` },
  });
}

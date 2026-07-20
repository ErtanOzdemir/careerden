import type {
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  Notification,
  PersistenceUnitOfWork,
} from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";

export class DeliverFollowUpReminderUseCase {
  constructor(
    private readonly reminders: FollowUpReminderRepository,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(
    payload: FollowUpReminderQueuePayload,
    now = new Date(),
  ): Promise<Notification | null> {
    const reminder = await this.reminders.findValidReminder(payload);
    if (!reminder) return null;
    return this.unitOfWork.execute(
      async ({ notifications, notificationChanges, followUpReminders, outbox }) => {
        if (!(await followUpReminders.markSent(payload, now))) return null;
        const summary = createFollowUpSummary(reminder.companyName, reminder.roleTitle);
        const notification = await notifications.create({
          profileId: reminder.profileId,
          jobApplicationId: reminder.jobApplicationId,
          type: "follow_up_reminder",
          title: reminder.title,
          body: createFollowUpBody(summary, reminder.description),
        });
        await notificationChanges.created(notification, summary);
        await outbox.add({
          type: outboxEventTypes.followUpReminderEmail,
          aggregateId: reminder.followUpId,
          payload: {
            messageId: `<follow-up-${reminder.followUpId}-${payload.scheduledFor}@link2cv.local>`,
            email: reminder.profileEmail,
            companyName: reminder.companyName,
            roleTitle: reminder.roleTitle,
            followUpAt: reminder.scheduledAt.toISOString(),
            title: reminder.title,
            description: reminder.description,
          },
        });
        return notification;
      },
    );
  }
}

function createFollowUpSummary(companyName?: string, roleTitle?: string) {
  const target = [companyName, roleTitle].filter(Boolean).join(" - ");
  return target ? `It is time to follow up on ${target}.` : "It is time to follow up.";
}

function createFollowUpBody(summary: string, description?: string) {
  return description ? `${summary}\n\n${description}` : summary;
}

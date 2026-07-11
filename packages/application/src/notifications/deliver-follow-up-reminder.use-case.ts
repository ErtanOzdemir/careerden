import type {
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  Notification,
  PersistenceUnitOfWork,
} from "@link2cv/domain";

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
    return this.unitOfWork.execute(async ({ notifications, followUpReminders }) => {
      if (!(await followUpReminders.markSent(payload, now))) return null;
      return notifications.create({
        profileId: reminder.profileId,
        jobApplicationId: reminder.jobApplicationId,
        type: "follow_up_reminder",
        title: reminder.title,
        body: createFollowUpBody(reminder.companyName, reminder.roleTitle, reminder.description),
      });
    });
  }
}

function createFollowUpBody(companyName?: string, roleTitle?: string, description?: string) {
  const target = [companyName, roleTitle].filter(Boolean).join(" - ");
  const context = target ? `It is time to follow up on ${target}.` : "It is time to follow up.";
  return description ? `${context}\n\n${description}` : context;
}

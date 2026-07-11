import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  JobApplicationFollowUp,
  JobApplicationRepository,
  UpdateJobApplicationFollowUpInput,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleFollowUp } from "./job-application-resource-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";
import { scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class UpdateJobApplicationFollowUpUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly queue: FollowUpReminderQueue,
    private readonly reminders: FollowUpReminderRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(
    jobApplicationId: string,
    followUpId: string,
    userId: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    const { followUp: existing } = await getAccessibleFollowUp(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      followUpId,
      userId,
    );
    const updated = await this.jobApplications.updateFollowUp(followUpId, input);
    if ("scheduledAt" in input && existing.reminderJobId)
      await this.queue.remove(existing.reminderJobId);
    if ("scheduledAt" in input) {
      await scheduleFollowUpReminder({
        followUp: updated,
        queue: this.queue,
        reminders: this.reminders,
      });
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "reminder",
        title: `Follow-up rescheduled: ${updated.title}`,
        occurredAt: updated.scheduledAt,
      });
    }
    await this.changes.changed(updated.jobApplicationId, updated.profileId);
    return updated;
  }
}

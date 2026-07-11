import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  JobApplicationFollowUp,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class CreateJobApplicationFollowUpUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly queue: FollowUpReminderQueue,
    private readonly reminders: FollowUpReminderRepository,
  ) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: { title: string; description?: string; scheduledAt: Date },
  ): Promise<JobApplicationFollowUp> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const followUp = await this.jobApplications.createFollowUp({
      jobApplicationId,
      profileId: jobApplication.profileId,
      ...input,
    });
    await scheduleFollowUpReminder({ followUp, queue: this.queue, reminders: this.reminders });
    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "reminder",
      title: `Follow-up scheduled: ${followUp.title}`,
      occurredAt: followUp.scheduledAt,
    });
    return followUp;
  }
}

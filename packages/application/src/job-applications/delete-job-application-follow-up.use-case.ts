import type {
  FollowUpReminderQueue,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleFollowUp } from "./job-application-resource-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class DeleteJobApplicationFollowUpUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly queue: FollowUpReminderQueue,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(jobApplicationId: string, followUpId: string, userId: string): Promise<void> {
    const { followUp } = await getAccessibleFollowUp(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      followUpId,
      userId,
    );
    if (followUp.reminderJobId) await this.queue.remove(followUp.reminderJobId);
    await this.jobApplications.deleteFollowUp(followUpId);
    await this.changes.changed(followUp.jobApplicationId, followUp.profileId);
  }
}

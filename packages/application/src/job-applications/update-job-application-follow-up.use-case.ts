import type {
  JobApplicationFollowUp,
  PersistenceUnitOfWork,
  UpdateJobApplicationFollowUpInput,
} from "@careerden/domain";
import { getAccessibleFollowUp } from "./job-application-resource-access.js";
import { cancelFollowUpReminder, scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class UpdateJobApplicationFollowUpUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    followUpId: string,
    userId: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    return this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        await getAccessibleFollowUp(
          jobApplications,
          profiles,
          jobApplicationId,
          followUpId,
          userId,
        );
        const updated = await jobApplications.updateFollowUp(followUpId, input);
        if ("scheduledAt" in input) {
          await cancelFollowUpReminder(outbox, followUpId);
          await scheduleFollowUpReminder({ followUp: updated, outbox });
          await jobApplications.addEvent({
            jobApplicationId,
            type: "reminder",
            title: `Follow-up rescheduled: ${updated.title}`,
            occurredAt: updated.scheduledAt,
          });
        }
        await jobApplicationChanges.changed(updated.jobApplicationId, updated.profileId);
        return updated;
      },
    );
  }
}

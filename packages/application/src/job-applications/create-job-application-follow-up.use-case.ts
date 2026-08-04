import type { JobApplicationFollowUp, PersistenceUnitOfWork } from "@careerden/domain";
import { getActiveAccessibleJobApplication } from "./job-application-access.js";
import { scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class CreateJobApplicationFollowUpUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: { title: string; description?: string; scheduledAt: Date },
  ): Promise<JobApplicationFollowUp> {
    return this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const jobApplication = await getActiveAccessibleJobApplication(
          jobApplications,
          profiles,
          jobApplicationId,
          userId,
        );
        const followUp = await jobApplications.createFollowUp({
          jobApplicationId,
          profileId: jobApplication.profileId,
          ...input,
        });
        await scheduleFollowUpReminder({ followUp, outbox });
        await jobApplications.addEvent({
          jobApplicationId,
          type: "reminder",
          title: `Follow-up scheduled: ${followUp.title}`,
          occurredAt: followUp.scheduledAt,
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
        return followUp;
      },
    );
  }
}

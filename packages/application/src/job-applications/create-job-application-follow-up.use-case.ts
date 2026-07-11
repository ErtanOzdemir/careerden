import type { JobApplicationFollowUp, PersistenceUnitOfWork } from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";
import { scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class CreateJobApplicationFollowUpUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: { title: string; description?: string; scheduledAt: Date },
  ): Promise<JobApplicationFollowUp> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
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
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      return followUp;
    });
  }
}

import type { PersistenceUnitOfWork } from "@link2cv/domain";
import { getAccessibleFollowUp } from "./job-application-resource-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";
import { cancelFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class DeleteJobApplicationFollowUpUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(jobApplicationId: string, followUpId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const { followUp } = await getAccessibleFollowUp(
        jobApplications,
        profiles,
        jobApplicationId,
        followUpId,
        userId,
      );
      await jobApplications.deleteFollowUp(followUpId);
      await cancelFollowUpReminder(outbox, followUpId);
      await enqueueJobApplicationChange(outbox, followUp.jobApplicationId, followUp.profileId);
    });
  }
}

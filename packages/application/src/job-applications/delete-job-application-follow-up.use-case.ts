import type { PersistenceUnitOfWork } from "@careerden/domain";
import { getAccessibleFollowUp } from "./job-application-resource-access.js";
import { cancelFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class DeleteJobApplicationFollowUpUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(jobApplicationId: string, followUpId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const { followUp } = await getAccessibleFollowUp(
          jobApplications,
          profiles,
          jobApplicationId,
          followUpId,
          userId,
        );
        await jobApplications.deleteFollowUp(followUpId);
        await cancelFollowUpReminder(outbox, followUpId);
        await jobApplicationChanges.changed(followUp.jobApplicationId, followUp.profileId);
      },
    );
  }
}

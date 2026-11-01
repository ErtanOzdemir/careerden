import type {
  JobApplication,
  PersistenceUnitOfWork,
  UpdateJobApplicationTrackingInput,
} from "@careerden/domain";
import { getActiveAccessibleJobApplication } from "@careerden/application";

export class UpdateJobApplicationTrackingUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: UpdateJobApplicationTrackingInput,
  ): Promise<JobApplication & { statusChangeId?: string }> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const existing = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const previousStatus = existing.tracking.applicationStatus;
      const updated = await jobApplications.updateTracking(jobApplicationId, input);

      let statusChangeId: string | undefined;
      if (input.applicationStatus && input.applicationStatus !== previousStatus) {
        ({ id: statusChangeId } = await jobApplications.addEvent({
          jobApplicationId,
          type: "status_changed",
          title: `Status changed to ${input.applicationStatus}`,
          metadata: { from: previousStatus, to: input.applicationStatus },
        }));
      }

      await jobApplicationChanges.changed(updated.id, updated.profileId);
      // The id lets the client offer to undo the status change.
      return statusChangeId ? { ...updated, statusChangeId } : updated;
    });
  }
}

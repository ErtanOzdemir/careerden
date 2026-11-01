import type { ApplicationStatus, JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import { ApplicationError, getActiveAccessibleJobApplication } from "@careerden/application";

// Takes back a status change made by mistake: the application returns to the status it had
// before, and the change leaves the history, so the pipeline never counts the stage it named.
// Only the latest change can be undone.
export class UndoJobApplicationStatusChangeUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    eventId: string,
    userId: string,
  ): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const existing = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const removed = await jobApplications.deleteLatestStatusChange(jobApplicationId, eventId);
      const from = removed?.metadata.from;
      if (
        !removed ||
        typeof from !== "string" ||
        removed.metadata.to !== existing.tracking.applicationStatus
      ) {
        throw new ApplicationError(
          "conflict",
          "The status has changed again since, so this change can't be undone",
        );
      }

      const restored = await jobApplications.updateTracking(jobApplicationId, {
        applicationStatus: from as ApplicationStatus,
      });
      await jobApplicationChanges.changed(restored.id, restored.profileId);
      return restored;
    });
  }
}

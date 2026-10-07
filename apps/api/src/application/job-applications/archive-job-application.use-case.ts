import {
  canArchiveJobApplication,
  type JobApplication,
  type PersistenceUnitOfWork,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getAccessibleJobApplication } from "@careerden/application";

export class ArchiveJobApplicationUseCase {
  constructor(
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const existing = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      if (existing.archivedAt) return existing;
      if (!canArchiveJobApplication(existing)) {
        throw new ApplicationError(
          "conflict",
          "Job applications cannot be archived while processing is queued or running",
        );
      }

      const archivedAt = this.now();
      const archived = await jobApplications.archive(jobApplicationId, archivedAt);
      if (!archived) {
        throw new ApplicationError(
          "conflict",
          "Job applications cannot be archived while processing is queued or running",
        );
      }
      await jobApplications.addEvent({
        jobApplicationId,
        type: "status_changed",
        title: "Application archived",
        occurredAt: archivedAt,
        metadata: { archivedAt: archivedAt.toISOString() },
      });
      await jobApplicationChanges.changed(archived.id, archived.profileId);
      return archived;
    });
  }
}

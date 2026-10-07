import type { JobApplication, PersistenceUnitOfWork } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getAccessibleJobApplication } from "@careerden/application";
import { scheduleFollowUpReminder } from "./schedule-follow-up-reminder.js";

export class RestoreJobApplicationUseCase {
  constructor(
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<JobApplication> {
    return this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const existing = await getAccessibleJobApplication(
          jobApplications,
          profiles,
          jobApplicationId,
          userId,
        );
        if (!existing.archivedAt) return existing;

        const restoredAt = this.now();
        const restored = await jobApplications.restore(jobApplicationId, restoredAt);
        if (!restored) {
          throw new ApplicationError("conflict", "Job application is no longer archived");
        }
        const followUps = await jobApplications.listFollowUps(jobApplicationId);
        await Promise.all(
          followUps
            .filter((followUp) => !followUp.reminderSentAt && followUp.scheduledAt > restoredAt)
            .map((followUp) => scheduleFollowUpReminder({ followUp, outbox })),
        );
        await jobApplications.addEvent({
          jobApplicationId,
          type: "status_changed",
          title: "Application restored",
          occurredAt: restoredAt,
          metadata: { restoredAt: restoredAt.toISOString() },
        });
        await jobApplicationChanges.changed(restored.id, restored.profileId);
        return restored;
      },
    );
  }
}

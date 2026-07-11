import type {
  JobApplication,
  PersistenceUnitOfWork,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class UpdateJobApplicationTrackingUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: UpdateJobApplicationTrackingInput,
  ): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const existing = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const previousStatus = existing.tracking.applicationStatus;
      const updated = await jobApplications.updateTracking(jobApplicationId, input);

      if (input.applicationStatus && input.applicationStatus !== previousStatus) {
        await jobApplications.addEvent({
          jobApplicationId,
          type: "status_changed",
          title: `Status changed to ${input.applicationStatus}`,
          metadata: { from: previousStatus, to: input.applicationStatus },
        });
      }

      await enqueueJobApplicationChange(outbox, updated.id, updated.profileId);
      return updated;
    });
  }
}

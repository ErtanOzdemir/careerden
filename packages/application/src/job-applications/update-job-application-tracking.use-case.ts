import type {
  JobApplication,
  JobApplicationRepository,
  UpdateJobApplicationTrackingInput,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class UpdateJobApplicationTrackingUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: UpdateJobApplicationTrackingInput,
  ): Promise<JobApplication> {
    const existing = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const previousStatus = existing.tracking.applicationStatus;
    const updated = await this.jobApplications.updateTracking(jobApplicationId, input);

    if (input.applicationStatus && input.applicationStatus !== previousStatus) {
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "status_changed",
        title: `Status changed to ${input.applicationStatus}`,
        metadata: { from: previousStatus, to: input.applicationStatus },
      });
    }

    await this.changes.changed(updated.id, updated.profileId);
    return updated;
  }
}

import type {
  JobApplication,
  JobApplicationRepository,
  UpdateJobApplicationTrackingInput,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class UpdateJobApplicationTrackingUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
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

    return updated;
  }
}

import type {
  FileStorage,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import {
  buildJobApplicationDetail,
  type JobApplicationDetail,
} from "./job-application-read-model.js";

export class GetJobApplicationDetailUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<JobApplicationDetail> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    return buildJobApplicationDetail({
      jobApplications: this.jobApplications,
      storage: this.storage,
      jobApplication,
    });
  }
}

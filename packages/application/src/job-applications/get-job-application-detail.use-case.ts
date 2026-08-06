import type {
  FileStorage,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { assessProfileReadiness } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
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
    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new ApplicationError("not_found", "Profile not found");
    }

    return buildJobApplicationDetail({
      jobApplications: this.jobApplications,
      storage: this.storage,
      jobApplication,
      profileReadiness: assessProfileReadiness(profile),
    });
  }
}

import type {
  JobApplication,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { ApplicationError } from "../application-error.js";

export async function getAccessibleJobApplication(
  jobApplications: JobApplicationRepository,
  profiles: UserProfileAccessRepository,
  jobApplicationId: string,
  userId: string,
): Promise<JobApplication> {
  const jobApplication = await jobApplications.findById(jobApplicationId);

  if (
    !jobApplication ||
    (await profiles.findUserIdByProfileId(jobApplication.profileId)) !== userId
  ) {
    throw new ApplicationError("not_found", "Job application not found");
  }

  return jobApplication;
}

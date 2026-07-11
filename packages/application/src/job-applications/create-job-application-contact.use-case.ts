import type {
  CreateJobApplicationContactInput,
  JobApplicationContact,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class CreateJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationContactInput, "jobApplicationId">,
  ): Promise<JobApplicationContact> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    return this.jobApplications.createContact({ jobApplicationId, ...input });
  }
}

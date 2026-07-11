import type { JobApplicationRepository, UserProfileAccessRepository } from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class EnsureJobApplicationAccessUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<void> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
  }
}

import type { JobApplicationRepository, UserProfileAccessRepository } from "@careerden/domain";
import { getAccessibleJobApplication } from "@careerden/application";

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

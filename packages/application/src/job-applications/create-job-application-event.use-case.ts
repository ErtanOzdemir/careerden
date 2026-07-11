import type {
  CreateJobApplicationEventInput,
  JobApplicationEvent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class CreateJobApplicationEventUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationEventInput, "jobApplicationId">,
  ): Promise<JobApplicationEvent> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    return this.jobApplications.addEvent({ jobApplicationId, ...input });
  }
}

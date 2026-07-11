import type {
  JobApplicationEvent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class ListJobApplicationEventsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(jobApplicationId: string, userId: string): Promise<JobApplicationEvent[]> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    return this.jobApplications.listEvents(jobApplicationId);
  }
}

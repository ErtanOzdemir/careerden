import type {
  JobApplicationContact,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class ListJobApplicationContactsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(jobApplicationId: string, userId: string): Promise<JobApplicationContact[]> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    return this.jobApplications.listContacts(jobApplicationId);
  }
}

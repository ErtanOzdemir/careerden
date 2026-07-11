import type { JobApplicationRepository, UserProfileAccessRepository } from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";

export class DeleteJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(jobApplicationId: string, contactId: string, userId: string): Promise<void> {
    await getAccessibleContact(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      contactId,
      userId,
    );
    await this.jobApplications.deleteContact(contactId);
  }
}

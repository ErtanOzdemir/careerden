import type {
  JobApplicationContact,
  JobApplicationRepository,
  UpdateJobApplicationContactInput,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";

export class UpdateJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}
  async execute(
    jobApplicationId: string,
    contactId: string,
    userId: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    await getAccessibleContact(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      contactId,
      userId,
    );
    return this.jobApplications.updateContact(contactId, input);
  }
}

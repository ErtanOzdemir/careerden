import type {
  JobApplicationContact,
  JobApplicationRepository,
  UpdateJobApplicationContactInput,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class UpdateJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(
    jobApplicationId: string,
    contactId: string,
    userId: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    const { jobApplication } = await getAccessibleContact(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      contactId,
      userId,
    );
    const contact = await this.jobApplications.updateContact(contactId, input);
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
    return contact;
  }
}

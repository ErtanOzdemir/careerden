import type { JobApplicationRepository, UserProfileAccessRepository } from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class DeleteJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(jobApplicationId: string, contactId: string, userId: string): Promise<void> {
    const { jobApplication } = await getAccessibleContact(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      contactId,
      userId,
    );
    await this.jobApplications.deleteContact(contactId);
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
  }
}

import type { PersistenceUnitOfWork } from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";

export class DeleteJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(jobApplicationId: string, contactId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const { jobApplication } = await getAccessibleContact(
        jobApplications,
        profiles,
        jobApplicationId,
        contactId,
        userId,
      );
      await jobApplications.deleteContact(contactId);
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
    });
  }
}

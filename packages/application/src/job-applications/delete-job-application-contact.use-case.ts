import type { PersistenceUnitOfWork } from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class DeleteJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(jobApplicationId: string, contactId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const { jobApplication } = await getAccessibleContact(
        jobApplications,
        profiles,
        jobApplicationId,
        contactId,
        userId,
      );
      await jobApplications.deleteContact(contactId);
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
    });
  }
}

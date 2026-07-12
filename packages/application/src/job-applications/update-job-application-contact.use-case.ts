import type {
  JobApplicationContact,
  PersistenceUnitOfWork,
  UpdateJobApplicationContactInput,
} from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";

export class UpdateJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    contactId: string,
    userId: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const { jobApplication } = await getAccessibleContact(
        jobApplications,
        profiles,
        jobApplicationId,
        contactId,
        userId,
      );
      const contact = await jobApplications.updateContact(contactId, input);
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return contact;
    });
  }
}

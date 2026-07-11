import type {
  JobApplicationContact,
  PersistenceUnitOfWork,
  UpdateJobApplicationContactInput,
} from "@link2cv/domain";
import { getAccessibleContact } from "./job-application-resource-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class UpdateJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    contactId: string,
    userId: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const { jobApplication } = await getAccessibleContact(
        jobApplications,
        profiles,
        jobApplicationId,
        contactId,
        userId,
      );
      const contact = await jobApplications.updateContact(contactId, input);
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      return contact;
    });
  }
}

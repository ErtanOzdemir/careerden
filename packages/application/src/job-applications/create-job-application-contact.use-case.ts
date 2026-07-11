import type {
  CreateJobApplicationContactInput,
  JobApplicationContact,
  PersistenceUnitOfWork,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class CreateJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationContactInput, "jobApplicationId">,
  ): Promise<JobApplicationContact> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const contact = await jobApplications.createContact({ jobApplicationId, ...input });
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      return contact;
    });
  }
}

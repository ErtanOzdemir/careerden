import type {
  CreateJobApplicationContactInput,
  JobApplicationContact,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { getActiveAccessibleJobApplication } from "./job-application-access.js";

export class CreateJobApplicationContactUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationContactInput, "jobApplicationId">,
  ): Promise<JobApplicationContact> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const contact = await jobApplications.createContact({ jobApplicationId, ...input });
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return contact;
    });
  }
}

import type {
  CreateJobApplicationEventInput,
  JobApplicationEvent,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { getActiveAccessibleJobApplication } from "./job-application-access.js";

export class CreateJobApplicationEventUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationEventInput, "jobApplicationId">,
  ): Promise<JobApplicationEvent> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const event = await jobApplications.addEvent({ jobApplicationId, ...input });
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return event;
    });
  }
}

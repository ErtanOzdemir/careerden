import type {
  CreateJobApplicationEventInput,
  JobApplicationEvent,
  PersistenceUnitOfWork,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class CreateJobApplicationEventUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationEventInput, "jobApplicationId">,
  ): Promise<JobApplicationEvent> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      const event = await jobApplications.addEvent({ jobApplicationId, ...input });
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      return event;
    });
  }
}

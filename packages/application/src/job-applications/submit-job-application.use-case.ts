import type {
  CreateJobApplicationInput,
  JobApplication,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleProfile } from "../profiles/profile-access.js";

export class SubmitJobApplicationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(input: CreateJobApplicationInput, userId: string): Promise<JobApplication> {
    if (!input.sourceUrl) {
      throw new ApplicationError("validation", "A LinkedIn source URL is required");
    }

    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      await getAccessibleProfile(profiles, input.profileId, userId);

      const jobApplication = await jobApplications.create(input);

      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);

      return jobApplication;
    });
  }
}

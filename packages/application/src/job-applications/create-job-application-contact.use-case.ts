import type {
  CreateJobApplicationContactInput,
  JobApplicationContact,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class CreateJobApplicationContactUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationContactInput, "jobApplicationId">,
  ): Promise<JobApplicationContact> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const contact = await this.jobApplications.createContact({ jobApplicationId, ...input });
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
    return contact;
  }
}

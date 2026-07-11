import type {
  CreateJobApplicationEventInput,
  JobApplicationEvent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class CreateJobApplicationEventUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}
  async execute(
    jobApplicationId: string,
    userId: string,
    input: Omit<CreateJobApplicationEventInput, "jobApplicationId">,
  ): Promise<JobApplicationEvent> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const event = await this.jobApplications.addEvent({ jobApplicationId, ...input });
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
    return event;
  }
}

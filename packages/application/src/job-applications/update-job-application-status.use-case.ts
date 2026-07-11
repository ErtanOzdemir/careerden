import type {
  JobApplication,
  JobApplicationRepository,
  JobApplicationStatus,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class UpdateJobApplicationStatusUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    status: JobApplicationStatus,
  ): Promise<JobApplication> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

    if (!canTransitionJobApplicationStatus(jobApplication.status, status)) {
      throw new ApplicationError("validation", "Invalid status transition");
    }

    await this.jobApplications.updateStatus(jobApplicationId, status);
    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "Scraping started",
    });

    const updated = await this.jobApplications.findById(jobApplicationId);
    if (!updated) throw new ApplicationError("not_found", "Job application not found");
    await this.changes.changed(updated.id, updated.profileId);
    return updated;
  }
}

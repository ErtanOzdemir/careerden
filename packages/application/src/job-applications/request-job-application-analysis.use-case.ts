import type {
  JobApplication,
  JobApplicationQueue,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class RequestJobApplicationAnalysisUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly queue: JobApplicationQueue,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<JobApplication> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

    if (jobApplication.status !== "scraped") {
      throw new ApplicationError(
        "validation",
        "AI analysis can only be started after scraping completes",
      );
    }
    if (!(await this.jobApplications.getScrapeBundle(jobApplicationId))) {
      throw new ApplicationError("validation", "AI analysis requires saved scrape data");
    }

    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "AI analysis requested",
    });
    await this.queue.enqueue({ jobApplicationId });
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
    return jobApplication;
  }
}

import type { JobApplication, PersistenceUnitOfWork } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";

export class RequestJobApplicationAnalysisUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(jobApplicationId: string, userId: string): Promise<JobApplication> {
    return this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const jobApplication = await getAccessibleJobApplication(
          jobApplications,
          profiles,
          jobApplicationId,
          userId,
        );

        if (jobApplication.status !== "scraped") {
          throw new ApplicationError(
            "validation",
            "AI analysis can only be started after scraping completes",
          );
        }
        if (!(await jobApplications.getScrapeBundle(jobApplicationId))) {
          throw new ApplicationError("validation", "AI analysis requires saved scrape data");
        }

        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "AI analysis requested",
        });
        await enqueueMatchAnalysisIfEnabled({
          jobApplications,
          outbox,
          jobApplicationId,
          autoRunMatchAnalysis: true,
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
        return jobApplication;
      },
    );
  }
}

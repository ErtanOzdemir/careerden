import type { JobApplication, JobApplicationStatus, PersistenceUnitOfWork } from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class UpdateJobApplicationStatusUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    status: JobApplicationStatus,
  ): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );

      if (!canTransitionJobApplicationStatus(jobApplication.status, status)) {
        throw new ApplicationError("validation", "Invalid status transition");
      }

      await jobApplications.updateStatus(jobApplicationId, status);
      await jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Scraping started",
      });

      const updated = await jobApplications.findById(jobApplicationId);
      if (!updated) throw new ApplicationError("not_found", "Job application not found");
      await jobApplicationChanges.changed(updated.id, updated.profileId);
      return updated;
    });
  }
}

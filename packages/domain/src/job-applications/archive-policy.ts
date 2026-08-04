import type { JobApplication } from "./job-application.js";
import type { JobApplicationStatus } from "./workflow-status.js";

export const archivableJobApplicationStatuses = [
  "scraped",
  "review_ready",
  "completed",
  "failed",
] as const satisfies readonly JobApplicationStatus[];

export function canArchiveJobApplication(
  jobApplication: Pick<JobApplication, "analysisAttemptId" | "archivedAt" | "status">,
): boolean {
  if (jobApplication.archivedAt) return true;
  if (
    !archivableJobApplicationStatuses.includes(
      jobApplication.status as (typeof archivableJobApplicationStatuses)[number],
    )
  ) {
    return false;
  }

  return jobApplication.status !== "scraped" || !jobApplication.analysisAttemptId;
}

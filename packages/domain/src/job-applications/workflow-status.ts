export const jobApplicationStatuses = [
  "queued",
  "scraping",
  "analyzing",
  "generating_documents",
  "completed",
  "failed",
] as const;

export type JobApplicationStatus = (typeof jobApplicationStatuses)[number];

const allowedTransitions: Record<JobApplicationStatus, JobApplicationStatus[]> = {
  queued: ["scraping", "failed"],
  scraping: ["analyzing", "failed"],
  analyzing: ["generating_documents", "failed"],
  generating_documents: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function canTransitionJobApplicationStatus(
  from: JobApplicationStatus,
  to: JobApplicationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

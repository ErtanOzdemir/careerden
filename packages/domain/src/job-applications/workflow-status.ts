export const jobApplicationStatuses = [
  "queued",
  "scraping",
  "analyzing",
  "review_ready",
  "generating_documents",
  "completed",
  "failed",
] as const;

export type JobApplicationStatus = (typeof jobApplicationStatuses)[number];

const allowedTransitions: Record<JobApplicationStatus, JobApplicationStatus[]> = {
  queued: ["scraping", "failed"],
  scraping: ["analyzing", "review_ready", "failed"],
  analyzing: ["review_ready", "failed"],
  review_ready: ["generating_documents", "failed"],
  generating_documents: ["completed", "failed"],
  completed: ["generating_documents"],
  failed: [],
};

export function canTransitionJobApplicationStatus(
  from: JobApplicationStatus,
  to: JobApplicationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

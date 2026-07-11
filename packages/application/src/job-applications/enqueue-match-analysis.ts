import type { JobApplicationQueue, JobApplicationRepository } from "@link2cv/domain";

export async function enqueueMatchAnalysisIfEnabled(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent">;
  queue: JobApplicationQueue;
  jobApplicationId: string;
  autoRunMatchAnalysis: boolean;
}): Promise<boolean> {
  if (input.autoRunMatchAnalysis) {
    await input.queue.enqueue({ jobApplicationId: input.jobApplicationId });
    return true;
  }

  await input.jobApplications.addEvent({
    jobApplicationId: input.jobApplicationId,
    type: "processing",
    title: "AI analysis skipped",
    body: "Auto-run match analysis is disabled for this profile.",
  });
  return false;
}

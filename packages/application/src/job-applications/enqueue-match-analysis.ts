import type { JobApplicationRepository, OutboxRepository } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";

export async function enqueueMatchAnalysisIfEnabled(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent" | "setAnalysisAttempt">;
  outbox: OutboxRepository;
  jobApplicationId: string;
  autoRunMatchAnalysis: boolean;
}): Promise<boolean> {
  if (input.autoRunMatchAnalysis) {
    const event = await input.outbox.add({
      type: outboxEventTypes.jobApplicationAnalysisRequested,
      aggregateId: input.jobApplicationId,
      payload: { jobApplicationId: input.jobApplicationId },
    });
    await input.jobApplications.setAnalysisAttempt(input.jobApplicationId, event.id);
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

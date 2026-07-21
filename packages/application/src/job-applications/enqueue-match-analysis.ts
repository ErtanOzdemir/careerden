import type {
  JobApplicationRepository,
  OutboxRepository,
  ProfileReadiness,
} from "@careerden/domain";
import { outboxEventTypes } from "@careerden/domain";

export async function enqueueMatchAnalysisIfEnabled(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent" | "setAnalysisAttempt">;
  outbox: OutboxRepository;
  jobApplicationId: string;
  autoRunMatchAnalysis: boolean;
  profileReadiness?: ProfileReadiness;
}): Promise<boolean> {
  if (input.profileReadiness?.state === "blocked") {
    await input.jobApplications.addEvent({
      jobApplicationId: input.jobApplicationId,
      type: "processing",
      title: "Profile action required",
      body: "Add positioning, skills, or career evidence before starting AI analysis.",
      metadata: { warnings: input.profileReadiness.warnings },
    });
    return false;
  }

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

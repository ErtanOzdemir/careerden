import type {
  CreditReservationReleaseReason,
  PersistenceTransaction,
  PersistenceUnitOfWork,
} from "@careerden/domain";

export interface FinalizeJobApplicationAnalysisFailureInput {
  jobApplicationId: string;
  analysisAttemptId: string;
  reason: string;
  releaseReason?: Extract<CreditReservationReleaseReason, "failure" | "timeout">;
}

export class FinalizeJobApplicationAnalysisFailureUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(input: FinalizeJobApplicationAnalysisFailureInput): Promise<boolean> {
    return this.unitOfWork.execute((transaction) =>
      finalizeJobApplicationAnalysisFailure(transaction, input),
    );
  }
}

export async function finalizeJobApplicationAnalysisFailure(
  transaction: PersistenceTransaction,
  input: FinalizeJobApplicationAnalysisFailureInput,
): Promise<boolean> {
  const now = new Date();
  const jobApplication = await transaction.jobApplications.findById(input.jobApplicationId);
  if (!jobApplication) {
    await transaction.credits.releaseReservation(
      input.analysisAttemptId,
      input.releaseReason ?? "failure",
      now,
    );
    return false;
  }
  if (jobApplication.analysisAttemptId !== input.analysisAttemptId) {
    await transaction.credits.releaseReservation(input.analysisAttemptId, "superseded", now);
    return false;
  }
  const failed = await transaction.jobApplications.failAnalysis(
    input.jobApplicationId,
    input.analysisAttemptId,
    input.reason,
  );
  if (!failed) {
    await transaction.credits.releaseReservation(input.analysisAttemptId, "superseded", now);
    return false;
  }
  await transaction.credits.releaseReservation(
    input.analysisAttemptId,
    input.releaseReason ?? "failure",
    now,
  );
  await transaction.jobApplications.addEvent({
    jobApplicationId: input.jobApplicationId,
    type: "processing",
    title: input.releaseReason === "timeout" ? "AI analysis timed out" : "AI analysis failed",
    body: input.reason,
    metadata: { attemptId: input.analysisAttemptId },
  });
  await transaction.jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
  return true;
}

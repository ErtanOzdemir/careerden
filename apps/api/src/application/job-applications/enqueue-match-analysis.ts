import type {
  CreditRepository,
  JobApplicationRepository,
  OutboxRepository,
  ProfileReadiness,
} from "@careerden/domain";
import {
  creditReservationDurationMs,
  matchAnalysisCreditCost,
} from "../../domain/billing/credit-policy.js";
import { outboxEventTypes } from "@careerden/domain";
import { randomUUID } from "node:crypto";
import { ApplicationError } from "@careerden/application";
import { ensureCurrentMonthlyCredits } from "../billing/ensure-current-monthly-credits.js";
import type { AiAvailability } from "../../domain/matching/ai-availability.js";

export async function enqueueMatchAnalysisIfEnabled(input: {
  credits: CreditRepository;
  jobApplications: Pick<
    JobApplicationRepository,
    "addEvent" | "clearAnalysisAttempt" | "setAnalysisAttempt"
  >;
  outbox: OutboxRepository;
  userId: string;
  jobApplicationId: string;
  autoRunMatchAnalysis: boolean;
  profileReadiness?: ProfileReadiness;
  insufficientCreditBehavior: "throw" | "skip";
  // Absent means AI is always available, as in the cloud runtime.
  aiAvailability?: AiAvailability;
  now?: Date;
  createAttemptId?: () => string;
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
    if (input.aiAvailability && !(await input.aiAvailability.isConfigured())) {
      if (input.insufficientCreditBehavior === "throw") {
        throw new ApplicationError(
          "ai_provider_not_configured",
          "Add an AI provider API key on the AI provider page to run AI analysis.",
        );
      }
      await input.jobApplications.addEvent({
        jobApplicationId: input.jobApplicationId,
        type: "processing",
        title: "AI analysis skipped",
        body: "The job was saved. Add an AI provider API key on the AI provider page to run AI analysis.",
        metadata: { reason: "ai_provider_not_configured" },
      });
      return false;
    }

    const now = input.now ?? new Date();
    const attemptId = input.createAttemptId?.() ?? randomUUID();
    const claimed = await input.jobApplications.setAnalysisAttempt(
      input.jobApplicationId,
      attemptId,
    );
    if (!claimed) {
      if (input.insufficientCreditBehavior === "throw") {
        throw new ApplicationError("conflict", "AI analysis is already queued or in progress");
      }
      return false;
    }

    await ensureCurrentMonthlyCredits(input.credits, input.userId, now);
    const reservation = await input.credits.reserve({
      id: attemptId,
      userId: input.userId,
      operationType: "match_analysis",
      resourceType: "job_application",
      resourceId: input.jobApplicationId,
      amount: matchAnalysisCreditCost,
      expiresAt: new Date(now.getTime() + creditReservationDurationMs),
      createdAt: now,
    });
    if (!reservation.reserved) {
      await input.jobApplications.clearAnalysisAttempt(input.jobApplicationId, attemptId);
      if (input.insufficientCreditBehavior === "throw") {
        throw new ApplicationError(
          "payment_required",
          "Not enough credits to start AI match analysis.",
          {
            requiredCredits: matchAnalysisCreditCost,
            availableCredits: reservation.availableCredits,
          },
        );
      }
      await input.jobApplications.addEvent({
        jobApplicationId: input.jobApplicationId,
        type: "processing",
        title: "AI analysis skipped",
        body: "The scrape was saved, but there are not enough credits to run AI analysis.",
        metadata: { reason: "insufficient_credits" },
      });
      return false;
    }

    await input.outbox.add({
      type: outboxEventTypes.jobApplicationAnalysisRequested,
      aggregateId: input.jobApplicationId,
      payload: { jobApplicationId: input.jobApplicationId, analysisAttemptId: attemptId },
    });
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

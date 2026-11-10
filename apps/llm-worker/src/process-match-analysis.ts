import { UnrecoverableError } from "bullmq";
import { analysisFailureFromError } from "@careerden/application";
import type {
  AnalyzeScrapedJobUseCase,
  FinalizeJobApplicationAnalysisFailureUseCase,
} from "@careerden/application";
import { AiProviderError } from "@careerden/domain";
import type { JobApplicationQueuePayload } from "@careerden/domain";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

export async function processMatchAnalysis(input: {
  payload: JobApplicationQueuePayload;
  attemptsMade: number;
  maximumAttempts: number;
  analyze: Pick<AnalyzeScrapedJobUseCase, "execute">;
  finalizeFailure: Pick<FinalizeJobApplicationAnalysisFailureUseCase, "execute">;
}): Promise<void> {
  try {
    await input.analyze.execute(input.payload);
  } catch (error) {
    if (error instanceof AiProviderError) {
      // Provider, status code, and category only: never the key, prompt, or response body.
      console.warn("LLM worker AI provider call failed", {
        event: "ai.provider_error",
        jobApplicationId: input.payload.jobApplicationId,
        ...error.toFailure(),
        retryable: error.retryable,
      });
    }
    const workerError = toBullMqWorkerError(error);
    const isFinalAttempt = input.attemptsMade + 1 >= input.maximumAttempts;
    if (workerError instanceof UnrecoverableError || isFinalAttempt) {
      await input.finalizeFailure.execute({
        jobApplicationId: input.payload.jobApplicationId,
        analysisAttemptId: input.payload.analysisAttemptId,
        ...analysisFailureFromError(error),
      });
    }
    throw workerError;
  }
}

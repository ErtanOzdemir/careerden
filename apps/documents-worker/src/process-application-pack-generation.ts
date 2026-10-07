import type { ApplicationPackGenerationQueuePayload } from "./domain/job-applications/application-pack-generation.queue.js";
import { ApplicationError } from "@careerden/application";
import type { FailApplicationPackGenerationUseCase } from "./application/job-applications/fail-application-pack-generation.use-case.js";
import type { GenerateRequestedApplicationPackUseCase } from "./application/job-applications/generate-requested-application-pack.use-case.js";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

export async function processApplicationPackGeneration(input: {
  payload: ApplicationPackGenerationQueuePayload;
  attemptsMade: number;
  maximumAttempts: number;
  generate: Pick<GenerateRequestedApplicationPackUseCase, "execute">;
  fail: Pick<FailApplicationPackGenerationUseCase, "execute">;
}): Promise<void> {
  try {
    await input.generate.execute(input.payload);
  } catch (error) {
    const isTerminal =
      error instanceof ApplicationError || input.attemptsMade + 1 >= input.maximumAttempts;
    if (isTerminal) {
      await input.fail.execute(
        input.payload,
        error instanceof Error ? error.message : "Unknown document generation error",
      );
    }
    throw toBullMqWorkerError(error);
  }
}

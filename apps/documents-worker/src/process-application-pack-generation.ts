import type { ApplicationPackGenerationQueuePayload } from "@link2cv/domain";
import { ApplicationError } from "@link2cv/application";
import type {
  FailApplicationPackGenerationUseCase,
  GenerateRequestedApplicationPackUseCase,
} from "@link2cv/application";
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

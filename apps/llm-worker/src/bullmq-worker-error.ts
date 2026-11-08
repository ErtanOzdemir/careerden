import { UnrecoverableError } from "bullmq";
import { ApplicationError } from "@careerden/application";
import { AiProviderError } from "@careerden/domain";

export function toBullMqWorkerError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new UnrecoverableError(`[${error.code}] ${error.message}`);
  }
  // A bad key, an empty balance, a removed model, or unusable output fails the same way on retry.
  if (error instanceof AiProviderError && !error.retryable) {
    return new UnrecoverableError(`[ai_provider_error:${error.category}] ${error.message}`);
  }

  return error;
}

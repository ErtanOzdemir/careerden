import { UnrecoverableError } from "bullmq";
import { ApplicationError } from "@careerden/application";

export function toBullMqWorkerError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new UnrecoverableError(`[${error.code}] ${error.message}`);
  }

  return error;
}

import { UnrecoverableError } from "bullmq";
import { ApplicationError } from "@link2cv/application";

export function toBullMqWorkerError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new UnrecoverableError(`[${error.code}] ${error.message}`);
  }

  return error;
}

import type { LocalDataStartupFailure } from "../local-backend/local-backend-messages.js";

// Why the local edition shows its recovery screen instead of the app.
export type StartupFailure =
  | LocalDataStartupFailure
  | {
      // The backend failed before it was ready for another reason, such as a crash or a timeout.
      reason: "start-failed";
      message: string;
      lastMigration?: string;
    }
  | {
      // The backend kept stopping after it had started, so automatic restarts were stopped.
      reason: "crash-loop";
      message: string;
      lastMigration?: string;
    };

export type StartupFailureReason = StartupFailure["reason"];

export class LocalBackendStartError extends Error {
  constructor(readonly failure: StartupFailure) {
    super(`The local backend failed to start: ${failure.message}`);
    this.name = "LocalBackendStartError";
  }
}

export function toStartupFailure(error: unknown): StartupFailure {
  if (error instanceof LocalBackendStartError) return error.failure;
  return {
    reason: "start-failed",
    message: error instanceof Error && error.message ? error.message : String(error),
  };
}

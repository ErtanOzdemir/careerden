import type { StartupFailureReason } from "./startup-failure.js";

const problems: Record<StartupFailureReason, string> = {
  "database-open": "The database could not be opened",
  migration: "A database update failed",
  "newer-version": "The data was created by a newer version",
  "start-failed": "The local data service did not start",
  "crash-loop": "The local data service kept stopping",
};

// A short sentence for the diagnostics summary copied from the recovery screen.
export function describeStartupProblem(reason: StartupFailureReason): string {
  return problems[reason];
}

// Replaced with "~" so copied text and log lines do not carry the user's account name.
export function redactHomeDir(text: string, homeDir: string): string {
  return homeDir.length > 1 ? text.split(homeDir).join("~") : text;
}

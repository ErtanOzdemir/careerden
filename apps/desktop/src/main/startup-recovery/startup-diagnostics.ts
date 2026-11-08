import type { StartupFailure, StartupFailureReason } from "./startup-failure.js";

export interface StartupDiagnosticsInput {
  failure: StartupFailure;
  appName: string;
  appVersion: string;
  electronVersion: string;
  platform: NodeJS.Platform;
  osVersion: string;
  arch: string;
  // The newest migration the data reached, when the failure itself does not say.
  lastMigration?: string | undefined;
  // Replaced with "~" so the copied text does not carry the user's account name.
  homeDir: string;
  now: Date;
}

const problems: Record<StartupFailureReason, string> = {
  "database-open": "The database could not be opened",
  migration: "A database update failed",
  "newer-version": "The data was created by a newer version",
  "start-failed": "The local data service did not start",
  "crash-loop": "The local data service kept stopping",
};

// Plain text the user can paste into a bug report. Holds no data from the database.
export function formatStartupDiagnostics(input: StartupDiagnosticsInput): string {
  const { failure } = input;
  const lastMigration = failure.lastMigration ?? input.lastMigration;
  const lines = [
    `${input.appName} startup diagnostics`,
    `Time: ${input.now.toISOString()}`,
    `App version: ${input.appVersion}`,
    `Electron: ${input.electronVersion}`,
    `OS: ${input.platform} ${input.osVersion} (${input.arch})`,
    `Problem: ${problems[failure.reason]} (${failure.reason})`,
    `Error: ${redactHomeDir(failure.message, input.homeDir)}`,
    `Last migration: ${lastMigration ?? "unknown"}`,
  ];
  if ("unknownMigrations" in failure && failure.unknownMigrations?.length) {
    lines.push(`Migrations from a newer version: ${failure.unknownMigrations.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function redactHomeDir(text: string, homeDir: string): string {
  return homeDir.length > 1 ? text.split(homeDir).join("~") : text;
}

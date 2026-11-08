import type { DesktopEdition } from "../desktop-runtime-config.js";
import type { LocalDatabaseDiagnostics } from "../local-backend/local-backend-messages.js";
import { describeStartupProblem } from "../startup-recovery/startup-diagnostics.js";
import type { StartupFailure } from "../startup-recovery/startup-failure.js";
import type { DesktopUpdateState } from "../updates/desktop-update-types.js";

export const diagnosticsLogLineCount = 50;

// Everything the summary shows. It holds versions, names, and statuses only: the AI provider
// is named but its key never reaches this object, and log lines were redacted when written.
export interface DiagnosticsReportInput {
  appName: string;
  appVersion: string;
  edition: DesktopEdition;
  versions: { electron?: string | undefined; chrome?: string | undefined; node?: string };
  platform: NodeJS.Platform;
  osVersion: string;
  arch: string;
  // Undefined when the local backend is not running or did not answer.
  database?: LocalDatabaseDiagnostics | undefined;
  // The newest migration the data reached when the backend last reported it.
  knownLastMigration?: string | undefined;
  // Null when no provider is configured.
  aiProvider: string | null;
  // Linux only: the secret store safeStorage encrypts AI keys with.
  safeStorageBackend?: string | undefined;
  // Undefined when the updater has not started, as on the recovery screen.
  update?: { state: DesktopUpdateState; lastCheckedAt?: Date | undefined } | undefined;
  // Present when the summary is copied from the startup recovery screen.
  startupFailure?: StartupFailure | undefined;
  logLines: string[];
  now: Date;
  // Applied to every value and log line before it is written, as a last line of defense.
  redact: (text: string) => string;
}

// A Markdown summary ready to paste into a GitHub issue.
export function formatDiagnosticsReport(input: DiagnosticsReportInput): string {
  const { redact } = input;
  const item = (label: string, value: string | undefined) =>
    `- **${label}:** ${inline(redact(value ?? "unknown"))}`;
  const sections: string[][] = [];

  sections.push([
    `## ${input.appName} diagnostics`,
    "",
    item("Generated", input.now.toISOString()),
  ]);

  sections.push([
    "### App",
    item("Version", input.appVersion),
    item("Edition", input.edition),
    item("Electron", input.versions.electron),
    item("Chromium", input.versions.chrome),
    ...(input.versions.node ? [item("Node.js", input.versions.node)] : []),
  ]);

  sections.push([
    "### System",
    item("OS", input.platform),
    item("OS version", input.osVersion),
    item("Architecture", input.arch),
  ]);

  if (input.edition === "local") {
    const lastMigration =
      input.database?.lastMigration ??
      input.startupFailure?.lastMigration ??
      input.knownLastMigration;
    sections.push([
      "### Local data",
      item(
        "Database engine",
        input.database?.engineVersion ??
          (input.database ? "unknown" : "unavailable (the local data service is not running)"),
      ),
      item("Last migration", lastMigration),
    ]);

    sections.push([
      "### AI",
      item("Provider", input.aiProvider ?? "not configured"),
      ...(input.platform === "linux"
        ? [item("Key storage backend", input.safeStorageBackend)]
        : []),
    ]);
  }

  sections.push(
    input.update
      ? [
          "### Updates",
          item("Status", input.update.state.status),
          item("Last check", input.update.lastCheckedAt?.toISOString() ?? "never"),
          ...(input.update.state.availableVersion
            ? [item("Available version", input.update.state.availableVersion)]
            : []),
          ...(input.update.state.errorMessage
            ? [item("Update error", input.update.state.errorMessage.slice(0, 300))]
            : []),
        ]
      : ["### Updates", item("Status", "not started")],
  );

  const failure = input.startupFailure;
  if (failure) {
    sections.push([
      "### Startup problem",
      item("Problem", `${describeStartupProblem(failure.reason)} (${failure.reason})`),
      item("Error", failure.message.slice(0, 500)),
      ...("unknownMigrations" in failure && failure.unknownMigrations?.length
        ? [item("Migrations from a newer version", failure.unknownMigrations.join(", "))]
        : []),
    ]);
  }

  const logLines = input.logLines.slice(-diagnosticsLogLineCount).map(redact);
  const fence = codeFence(logLines);
  sections.push([
    `### Recent log (last ${logLines.length} lines)`,
    "",
    "<details>",
    "<summary>Log lines</summary>",
    "",
    `${fence}text`,
    ...(logLines.length > 0 ? logLines : ["(the log is empty)"]),
    fence,
    "",
    "</details>",
  ]);

  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

// Keeps a value on its bullet line.
function inline(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

// A fence longer than any backtick run in the log, so a line cannot close the block early.
function codeFence(lines: string[]): string {
  const longestRun = Math.max(
    0,
    ...lines.flatMap((line) => line.match(/`+/g) ?? []).map((run) => run.length),
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

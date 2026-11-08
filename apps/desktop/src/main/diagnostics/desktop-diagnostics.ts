import type { LocalDatabaseDiagnostics } from "../local-backend/local-backend-messages.js";
import type { StartupFailure } from "../startup-recovery/startup-failure.js";
import type { DesktopUpdateState } from "../updates/desktop-update-types.js";
import {
  diagnosticsLogLineCount,
  formatDiagnosticsReport,
  type DiagnosticsReportInput,
} from "./diagnostics-report.js";

type StaticDiagnostics = Pick<
  DiagnosticsReportInput,
  "appName" | "appVersion" | "edition" | "versions" | "platform" | "osVersion" | "arch"
>;

// Where each part of the summary comes from. Every source may fail or be missing; the summary is
// still copied with that part marked unknown.
export interface DesktopDiagnosticsSources extends StaticDiagnostics {
  describeDatabase?: () => Promise<LocalDatabaseDiagnostics | undefined>;
  knownLastMigration?: () => string | undefined;
  // Returns the provider's name only, never its key.
  getAiProvider?: () => Promise<string | null>;
  getSafeStorageBackend?: () => string | undefined;
  getUpdate?: () => { state: DesktopUpdateState; lastCheckedAt?: Date | undefined } | undefined;
  readLogTail: (lineCount: number) => Promise<string[]>;
  redact: (text: string) => string;
  now?: () => Date;
}

// Builds the Markdown diagnostics summary in the main process, for Settings and for the startup
// recovery screen alike.
export class DesktopDiagnostics {
  constructor(private readonly sources: DesktopDiagnosticsSources) {}

  async collect(startupFailure?: StartupFailure): Promise<string> {
    const { sources } = this;
    const [database, aiProvider, logLines] = await Promise.all([
      settle(() => sources.describeDatabase?.(), undefined),
      settle(() => sources.getAiProvider?.() ?? Promise.resolve(null), null),
      settle(() => sources.readLogTail(diagnosticsLogLineCount), [] as string[]),
    ]);
    return formatDiagnosticsReport({
      appName: sources.appName,
      appVersion: sources.appVersion,
      edition: sources.edition,
      versions: sources.versions,
      platform: sources.platform,
      osVersion: sources.osVersion,
      arch: sources.arch,
      database,
      knownLastMigration: attempt(() => sources.knownLastMigration?.()),
      aiProvider,
      safeStorageBackend: attempt(() => sources.getSafeStorageBackend?.()),
      update: attempt(() => sources.getUpdate?.()),
      startupFailure,
      logLines,
      now: sources.now?.() ?? new Date(),
      redact: sources.redact,
    });
  }
}

async function settle<T>(read: () => Promise<T> | undefined, fallback: T): Promise<T> {
  try {
    return (await read()) ?? fallback;
  } catch {
    return fallback;
  }
}

function attempt<T>(read: () => T | undefined): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

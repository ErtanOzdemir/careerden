import { describe, expect, it } from "vitest";
import { formatDiagnosticsReport, type DiagnosticsReportInput } from "./diagnostics-report.js";

const base: DiagnosticsReportInput = {
  appName: "Careerden Unplugged",
  appVersion: "0.7.0",
  edition: "local",
  versions: { electron: "43.1.0", chrome: "140.0.7339.41", node: "22.18.0" },
  platform: "darwin",
  osVersion: "26.0",
  arch: "arm64",
  database: {
    engineVersion: "PGlite (PostgreSQL 17.5)",
    lastMigration: "20261031000000_profile_onboarding_state.cjs",
  },
  aiProvider: "openai",
  update: {
    state: { status: "up-to-date", currentVersion: "0.7.0", required: false },
    lastCheckedAt: new Date("2026-11-08T09:00:00.000Z"),
  },
  logLines: ['{"level":"info","event":"app.started"}'],
  now: new Date("2026-11-08T10:00:00.000Z"),
  redact: (text) => text,
};

describe("formatDiagnosticsReport", () => {
  it("lists the app, system, data, AI, update, and log details as Markdown", () => {
    expect(formatDiagnosticsReport(base)).toBe(
      [
        "## Careerden Unplugged diagnostics",
        "",
        "- **Generated:** 2026-11-08T10:00:00.000Z",
        "",
        "### App",
        "- **Version:** 0.7.0",
        "- **Edition:** local",
        "- **Electron:** 43.1.0",
        "- **Chromium:** 140.0.7339.41",
        "- **Node.js:** 22.18.0",
        "",
        "### System",
        "- **OS:** darwin",
        "- **OS version:** 26.0",
        "- **Architecture:** arm64",
        "",
        "### Local data",
        "- **Database engine:** PGlite (PostgreSQL 17.5)",
        "- **Last migration:** 20261031000000_profile_onboarding_state.cjs",
        "",
        "### AI",
        "- **Provider:** openai",
        "",
        "### Updates",
        "- **Status:** up-to-date",
        "- **Last check:** 2026-11-08T09:00:00.000Z",
        "",
        "### Recent log (last 1 lines)",
        "",
        "<details>",
        "<summary>Log lines</summary>",
        "",
        "```text",
        '{"level":"info","event":"app.started"}',
        "```",
        "",
        "</details>",
        "",
      ].join("\n"),
    );
  });

  it("names the Linux key storage backend only on Linux", () => {
    expect(formatDiagnosticsReport(base)).not.toContain("Key storage backend");
    expect(
      formatDiagnosticsReport({
        ...base,
        platform: "linux",
        safeStorageBackend: "gnome_libsecret",
      }),
    ).toContain("- **Key storage backend:** gnome_libsecret");
  });

  it("describes a startup failure and falls back to the migration it reports", () => {
    const text = formatDiagnosticsReport({
      ...base,
      database: undefined,
      aiProvider: null,
      update: undefined,
      startupFailure: {
        reason: "newer-version",
        message: "This data was created by a newer version of Careerden.",
        lastMigration: "20261012000000_auth_rate_limits.cjs",
        unknownMigrations: ["29990101000000_future.cjs"],
      },
    });

    expect(text).toContain(
      "- **Database engine:** unavailable (the local data service is not running)",
    );
    expect(text).toContain("- **Last migration:** 20261012000000_auth_rate_limits.cjs");
    expect(text).toContain("- **Provider:** not configured");
    expect(text).toContain("### Updates\n- **Status:** not started");
    expect(text).toContain(
      "- **Problem:** The data was created by a newer version (newer-version)",
    );
    expect(text).toContain("- **Migrations from a newer version:** 29990101000000_future.cjs");
  });

  it("leaves local data and AI details out of the cloud edition", () => {
    const text = formatDiagnosticsReport({ ...base, appName: "Careerden", edition: "cloud" });

    expect(text).not.toContain("### Local data");
    expect(text).not.toContain("### AI");
  });

  it("keeps at most 50 log lines and a fence no log line can close", () => {
    const lines = Array.from({ length: 60 }, (_, index) => `line ${index}`);
    lines.push("a ```` run");
    const text = formatDiagnosticsReport({ ...base, logLines: lines });

    expect(text).toContain("### Recent log (last 50 lines)");
    expect(text).not.toContain("line 10\n");
    expect(text).toContain("line 59");
    expect(text).toContain("`````text\n");
  });

  it("redacts every value and log line and keeps values on one line", () => {
    const text = formatDiagnosticsReport({
      ...base,
      update: {
        state: {
          status: "error",
          currentVersion: "0.7.0",
          required: false,
          errorMessage: "Failed at /Users/ada/Library\nsecond line",
        },
      },
      logLines: ['{"path":"/Users/ada/Library/logs"}'],
      redact: (value) => value.split("/Users/ada").join("~"),
    });

    expect(text).not.toContain("/Users/ada");
    expect(text).toContain("- **Update error:** Failed at ~/Library second line");
    expect(text).toContain("- **Last check:** never");
  });
});

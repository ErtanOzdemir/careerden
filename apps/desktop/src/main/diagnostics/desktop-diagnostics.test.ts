import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopLogger } from "../logging/desktop-logger.js";
import { DesktopDiagnostics, type DesktopDiagnosticsSources } from "./desktop-diagnostics.js";

const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";
const sessionToken = "Zm9vYmFyYmF6cXV4c2Vzc2lvbnRva2VuMTIzNDU2";
const homeDir = "/Users/ada.lovelace";

describe("DesktopDiagnostics", () => {
  let directory: string;
  let logger: DesktopLogger;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-diagnostics-"));
    logger = new DesktopLogger({ directory: join(directory, "logs"), homeDir });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function sources(overrides: Partial<DesktopDiagnosticsSources> = {}): DesktopDiagnosticsSources {
    return {
      appName: "Careerden Unplugged",
      appVersion: "0.7.0",
      edition: "local",
      versions: { electron: "43.1.0", chrome: "140.0.7339.41" },
      platform: "linux",
      osVersion: "6.8.0",
      arch: "x64",
      describeDatabase: async () => ({
        engineVersion: "PGlite (PostgreSQL 17.5)",
        lastMigration: "20261031000000_profile_onboarding_state.cjs",
      }),
      getAiProvider: async () => "anthropic",
      getSafeStorageBackend: () => "gnome_libsecret",
      getUpdate: () => ({
        state: { status: "idle", currentVersion: "0.7.0", required: false },
      }),
      readLogTail: (lineCount) => logger.readTail(lineCount),
      redact: (text) => logger.redactText(text),
      now: () => new Date("2026-11-08T10:00:00.000Z"),
      ...overrides,
    };
  }

  it("collects a complete summary with the last 50 log lines", async () => {
    for (let index = 0; index < 60; index += 1) logger.info("test.line", { index });

    const text = await new DesktopDiagnostics(sources()).collect();

    expect(text).toContain("- **Version:** 0.7.0");
    expect(text).toContain("- **Chromium:** 140.0.7339.41");
    expect(text).toContain("- **OS version:** 6.8.0");
    expect(text).toContain("- **Database engine:** PGlite (PostgreSQL 17.5)");
    expect(text).toContain("- **Provider:** anthropic");
    expect(text).toContain("- **Key storage backend:** gnome_libsecret");
    expect(text).toContain("- **Status:** idle");
    expect(text).toContain("### Recent log (last 50 lines)");
    expect(text).toContain('"index":59');
    expect(text).not.toContain('"index":9}');
  });

  it("never includes an API key, session token, profile content, or the home folder", async () => {
    logger.registerSecret(sessionToken);
    logger.registerSecret(apiKey);
    // Entries as careless code might write them: secrets in values and in sensitive field names.
    logger.error("ai.request_failed", {
      errorMessage: `Incorrect API key provided: ${apiKey}`,
      url: `http://127.0.0.1:4100/?token=${sessionToken}`,
      path: `${homeDir}/Library/Application Support/Careerden Unplugged/data`,
    });
    logger.info("profile.saved", {
      profileSummary: "Senior engineer at Example Corp, ada@example.com",
      apiKey,
      authorization: `Bearer ${sessionToken}`,
    });
    const aiSelection = { provider: "openai", apiKey };
    const getAiProvider = vi.fn(async () => aiSelection.provider);

    const text = await new DesktopDiagnostics(
      sources({
        getAiProvider,
        getUpdate: () => ({
          state: {
            status: "error",
            currentVersion: "0.7.0",
            required: false,
            errorMessage: `GET https://user:${apiKey}@example.com failed in ${homeDir}`,
          },
        }),
      }),
    ).collect({
      reason: "migration",
      message: `Migration failed in ${homeDir}/data with token=${sessionToken}`,
    });

    expect(getAiProvider).toHaveBeenCalledOnce();
    expect(text).toContain("- **Provider:** openai");
    for (const secret of [apiKey, sessionToken, apiKey.slice(0, 12), sessionToken.slice(-12)]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toContain("Example Corp");
    expect(text).not.toContain("ada@example.com");
    expect(text).not.toContain(homeDir);
    expect(text).toContain("[REDACTED]");
  });

  it("copies a summary even when every optional source fails", async () => {
    const text = await new DesktopDiagnostics(
      sources({
        describeDatabase: async () => {
          throw new Error("backend stopped");
        },
        getAiProvider: async () => {
          throw new Error("keychain locked");
        },
        getSafeStorageBackend: () => {
          throw new Error("not ready");
        },
        getUpdate: () => undefined,
        readLogTail: async () => {
          throw new Error("EACCES");
        },
      }),
    ).collect();

    expect(text).toContain("- **Database engine:** unavailable");
    expect(text).toContain("- **Provider:** not configured");
    expect(text).toContain("- **Key storage backend:** unknown");
    expect(text).toContain("- **Status:** not started");
    expect(text).toContain("(the log is empty)");
  });

  it("includes the startup failure when copied from the recovery screen", async () => {
    const text = await new DesktopDiagnostics(
      sources({ describeDatabase: async () => undefined, knownLastMigration: () => undefined }),
    ).collect({
      reason: "migration",
      message: "A database update failed: column already exists",
      lastMigration: "20261012000000_auth_rate_limits.cjs",
    });

    expect(text).toContain("### Startup problem");
    expect(text).toContain("- **Problem:** A database update failed (migration)");
    expect(text).toContain("- **Last migration:** 20261012000000_auth_rate_limits.cjs");
  });
});

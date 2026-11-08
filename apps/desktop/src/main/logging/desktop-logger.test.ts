import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DesktopLogger,
  desktopLogFileName,
  resolveDesktopLogsDirectory,
} from "./desktop-logger.js";

describe("DesktopLogger", () => {
  let userData: string;
  let directory: string;

  beforeEach(async () => {
    userData = await mkdtemp(join(tmpdir(), "careerden-desktop-log-"));
    directory = resolveDesktopLogsDirectory(userData);
  });

  afterEach(async () => {
    await rm(userData, { recursive: true, force: true });
  });

  function readLog(): string {
    return readFileSync(join(directory, desktopLogFileName), "utf8");
  }

  it("writes JSON lines tagged with their process under userData/logs", () => {
    const logger = new DesktopLogger({ directory, now: () => new Date("2026-11-08T10:00:00Z") });

    logger.info("app.started", { version: "1.2.3", edition: "local" });
    logger.forSource("local-backend")({
      level: "error",
      event: "migration.failed",
      fields: { errorName: "Error" },
    });

    expect(directory).toBe(join(userData, "logs"));
    expect(
      readLog()
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual([
      {
        time: "2026-11-08T10:00:00.000Z",
        level: "info",
        process: "main",
        event: "app.started",
        version: "1.2.3",
        edition: "local",
      },
      {
        time: "2026-11-08T10:00:00.000Z",
        level: "error",
        process: "local-backend",
        event: "migration.failed",
        errorName: "Error",
      },
    ]);
  });

  it("keeps API keys, the session token, and profile data out of the log", () => {
    const apiKey = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    const sessionToken = "Zm9vYmFyLXNlc3Npb24tdG9rZW4tdmFsdWUtMTIzNDU2";
    const profileText = "Ada Lovelace, 12 Analytical Street, ada@example.com";
    const logger = new DesktopLogger({ directory });
    logger.registerSecret(apiKey);
    logger.registerSecret(sessionToken);

    logger.exception(
      "ai.request_failed",
      new Error(`Invalid x-api-key ${apiKey} (ends with ${apiKey.slice(-12)})`),
    );
    logger.forSource("local-backend")({
      level: "error",
      event: "api.unexpected_error",
      fields: {
        errorMessage: `request with x-careerden-local-token: ${sessionToken} failed; token=${sessionToken}`,
        header: `Authorization: Bearer ${sessionToken}`,
        profile: profileText,
        jobDescription: "Senior engineer posting text",
        prompt: "Write a cover letter for Ada",
        modelOutput: "Dear hiring manager",
        apiKey,
      },
    });

    const log = readLog();
    for (const forbidden of [
      apiKey,
      apiKey.slice(-12),
      sessionToken,
      profileText,
      "Senior engineer posting text",
      "Write a cover letter",
      "Dear hiring manager",
    ]) {
      expect(log).not.toContain(forbidden);
    }
    expect(log).toContain("[REDACTED]");
    expect(log).toContain('"event":"api.unexpected_error"');
  });

  it("replaces the home directory in paths", () => {
    const logger = new DesktopLogger({ directory, homeDir: "/Users/ada" });

    logger.exception("migration.failed", new Error("Cannot open /Users/ada/Library/data/pglite"));

    expect(readLog()).toContain("Cannot open ~/Library/data/pglite");
    expect(readLog()).not.toContain("/Users/ada");
  });

  it("drops non-primitive, malformed, and reserved fields", () => {
    const logger = new DesktopLogger({ directory });

    logger.forSource("scraper")({
      level: "warn",
      event: "scrape.failed",
      fields: {
        level: "debug",
        "bad key": "x",
        statusCode: 429,
        nested: { profile: "Ada" } as never,
      } as never,
    });

    const entry = JSON.parse(readLog()) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "warn", process: "scraper", statusCode: 429 });
    expect(entry).not.toHaveProperty("bad key");
    expect(JSON.stringify(entry)).not.toContain("Ada");
  });

  it("writes debug entries only after debug logging is enabled", () => {
    const logger = new DesktopLogger({ directory });

    logger.debug("scrape.succeeded");
    logger.info("app.started");
    logger.setLevel("debug");
    logger.debug("scrape.succeeded", { durationMs: 12 });

    const events = readLog()
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as { event: string; level: string }).level);
    expect(events).toEqual(["info", "debug"]);
  });

  it("rotates so no log file exceeds the configured size", () => {
    const maxFileBytes = 1_024;
    const logger = new DesktopLogger({ directory, maxFileBytes, maxFiles: 5 });

    for (let index = 0; index < 1_000; index += 1) {
      logger.info("local_backend.ready", { index, durationMs: index * 3 });
    }

    const files = readdirSync(directory);
    expect(files).toHaveLength(5);
    for (const name of files) {
      expect(statSync(join(directory, name)).size).toBeLessThanOrEqual(maxFileBytes);
    }
  });

  it("reads the last lines across rotated files, oldest first", async () => {
    const logger = new DesktopLogger({ directory, maxFileBytes: 300, maxFiles: 5 });
    for (let index = 0; index < 20; index += 1) logger.info("update.status", { index });

    const tail = await logger.readTail(6);

    expect(tail.map((line) => (JSON.parse(line) as { index: number }).index)).toEqual([
      14, 15, 16, 17, 18, 19,
    ]);
  });

  it("returns no lines before anything was written", async () => {
    await expect(new DesktopLogger({ directory }).readTail(50)).resolves.toEqual([]);
  });
});

import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const envKeys = [
  "PORT",
  "NODE_ENV",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "LINKEDIN_SESSION_STORAGE_DIR",
  "LINKEDIN_SESSION_SECRET",
];

const originalCwd = process.cwd();
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
let tempDirectory: string | undefined;

afterEach(() => {
  process.chdir(originalCwd);

  if (tempDirectory) {
    rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = undefined;
  }

  for (const key of envKeys) {
    const originalValue = originalEnv.get(key);

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

describe("loadEnv", () => {
  it("loads the nearest .env from a parent directory", () => {
    for (const key of envKeys) {
      delete process.env[key];
    }

    tempDirectory = mkdtempSync(join(tmpdir(), "careerden-config-"));
    const nestedDirectory = join(tempDirectory, "apps", "desktop");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(join(tempDirectory, ".env"), "PORT=3100");

    process.chdir(nestedDirectory);

    const env = loadEnv();

    expect(env.PORT).toBe(3100);
  });

  it("keeps the environment surface local-only", () => {
    const env = loadEnv({
      PORT: "3200",
    });

    expect(Object.keys(env).sort()).toEqual([
      "AI_PROVIDER",
      "LINKEDIN_SESSION_SECRET",
      "LINKEDIN_SESSION_STORAGE_DIR",
      "NODE_ENV",
      "PORT",
    ]);
  });

  it("resolves LinkedIn session storage directory relative to the loaded .env file", () => {
    for (const key of envKeys) {
      delete process.env[key];
    }

    tempDirectory = mkdtempSync(join(tmpdir(), "careerden-config-"));
    const nestedDirectory = join(tempDirectory, "apps", "desktop");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(
      join(tempDirectory, ".env"),
      "LINKEDIN_SESSION_STORAGE_DIR=./storage/linkedin-session",
    );

    process.chdir(nestedDirectory);

    const env = loadEnv();

    const resolvedTempDirectory = realpathSync(tempDirectory);

    expect(env.LINKEDIN_SESSION_STORAGE_DIR).toBe(
      join(resolvedTempDirectory, "storage", "linkedin-session"),
    );
  });
});

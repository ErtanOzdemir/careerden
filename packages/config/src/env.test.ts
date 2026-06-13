import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const envKeys = [
  "DATABASE_URL",
  "REDIS_URL",
  "PORT",
  "NODE_ENV",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "FILE_STORAGE_DIR",
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

    tempDirectory = mkdtempSync(join(tmpdir(), "link2cv-config-"));
    const nestedDirectory = join(tempDirectory, "apps", "api");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(
      join(tempDirectory, ".env"),
      [
        "DATABASE_URL=postgres://link2cv:link2cv@localhost:5432/link2cv",
        "REDIS_URL=redis://localhost:6379",
        "PORT=3100",
      ].join("\n"),
    );

    process.chdir(nestedDirectory);

    const env = loadEnv();

    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.PORT).toBe(3100);
  });

  it("prefers explicit input over process env", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://link2cv:link2cv@localhost:5432/link2cv",
      REDIS_URL: "redis://redis:6379",
    });

    expect(env.REDIS_URL).toBe("redis://redis:6379");
  });

  it("resolves storage directories relative to the loaded .env file", () => {
    for (const key of envKeys) {
      delete process.env[key];
    }

    tempDirectory = mkdtempSync(join(tmpdir(), "link2cv-config-"));
    const nestedDirectory = join(tempDirectory, "apps", "worker");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(
      join(tempDirectory, ".env"),
      [
        "DATABASE_URL=postgres://link2cv:link2cv@localhost:5432/link2cv",
        "REDIS_URL=redis://localhost:6379",
        "FILE_STORAGE_DIR=./storage",
        "LINKEDIN_SESSION_STORAGE_DIR=./storage/linkedin-session",
      ].join("\n"),
    );

    process.chdir(nestedDirectory);

    const env = loadEnv();

    const resolvedTempDirectory = realpathSync(tempDirectory);

    expect(env.FILE_STORAGE_DIR).toBe(join(resolvedTempDirectory, "storage"));
    expect(env.LINKEDIN_SESSION_STORAGE_DIR).toBe(
      join(resolvedTempDirectory, "storage", "linkedin-session")
    );
  });
});

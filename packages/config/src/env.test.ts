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
  "RUSTFS_ENDPOINT",
  "RUSTFS_ACCESS_KEY",
  "RUSTFS_SECRET_KEY",
  "RUSTFS_BUCKET",
  "RUSTFS_REGION",
  "RUSTFS_PUBLIC_ENDPOINT",
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

  it("uses RustFS defaults for generated document storage", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://link2cv:link2cv@localhost:5432/link2cv",
    });

    expect(env.RUSTFS_ENDPOINT).toBe("http://localhost:9000");
    expect(env.RUSTFS_ACCESS_KEY).toBe("rustfsadmin");
    expect(env.RUSTFS_SECRET_KEY).toBe("rustfsadmin");
    expect(env.RUSTFS_BUCKET).toBe("link2cv-files");
    expect(env.RUSTFS_REGION).toBe("us-east-1");
    expect(env.RUSTFS_PUBLIC_ENDPOINT).toBeUndefined();
  });

  it("loads explicit RustFS settings", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://link2cv:link2cv@localhost:5432/link2cv",
      RUSTFS_ENDPOINT: "http://rustfs:9000",
      RUSTFS_ACCESS_KEY: "access-key",
      RUSTFS_SECRET_KEY: "secret-key",
      RUSTFS_BUCKET: "custom-bucket",
      RUSTFS_REGION: "eu-central-1",
      RUSTFS_PUBLIC_ENDPOINT: "https://files.example.com",
    });

    expect(env.RUSTFS_ENDPOINT).toBe("http://rustfs:9000");
    expect(env.RUSTFS_ACCESS_KEY).toBe("access-key");
    expect(env.RUSTFS_SECRET_KEY).toBe("secret-key");
    expect(env.RUSTFS_BUCKET).toBe("custom-bucket");
    expect(env.RUSTFS_REGION).toBe("eu-central-1");
    expect(env.RUSTFS_PUBLIC_ENDPOINT).toBe("https://files.example.com");
  });

  it("resolves LinkedIn session storage directory relative to the loaded .env file", () => {
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
        "LINKEDIN_SESSION_STORAGE_DIR=./storage/linkedin-session",
      ].join("\n"),
    );

    process.chdir(nestedDirectory);

    const env = loadEnv();

    const resolvedTempDirectory = realpathSync(tempDirectory);

    expect(env.LINKEDIN_SESSION_STORAGE_DIR).toBe(
      join(resolvedTempDirectory, "storage", "linkedin-session")
    );
  });
});

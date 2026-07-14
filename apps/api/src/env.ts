import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
  BETTER_AUTH_SECRET: z.string().min(16).default("dev-only-link2cv-better-auth-secret"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().min(1).default("Link2CV <no-reply@link2cv.local>"),
  AI_PROVIDER: z.enum(["openai", "gemini", "deepseek"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GOTENBERG_URL: z.string().url().default("http://localhost:3002"),
  RUSTFS_ENDPOINT: z.string().url().default("http://localhost:9000"),
  RUSTFS_BUCKET: z.string().min(1).default("link2cv"),
  RUSTFS_ACCESS_KEY_ID: z.string().min(1).default("rustfsadmin"),
  RUSTFS_SECRET_ACCESS_KEY: z.string().min(1).default("rustfsadmin"),
  RUSTFS_REGION: z.string().min(1).default("us-east-1"),
  RUSTFS_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  OPEN_OBSERVE_URL: z.string().url().default("http://localhost:5080"),
  OPEN_OBSERVE_KEY: z.string().min(1),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(input = process.env): ApiEnv {
  const envFilePath = findNearestEnvFile();
  config(envFilePath ? { path: envFilePath } : undefined);

  return apiEnvSchema.parse(input);
}

function findNearestEnvFile(startDirectory = process.cwd()): string | undefined {
  let currentDirectory = startDirectory;
  const rootDirectory = parse(startDirectory).root;

  while (true) {
    const candidate = join(currentDirectory, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDirectory === rootDirectory) {
      return undefined;
    }

    currentDirectory = dirname(currentDirectory);
  }
}

import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  AI_PROVIDER: z.enum(["openai", "gemini", "deepseek"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  LINKEDIN_SESSION_STORAGE_DIR: z.string().default("./storage/linkedin-session"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(input?: NodeJS.ProcessEnv): AppEnv {
  const envFilePath = findNearestEnvFile();
  config(envFilePath ? { path: envFilePath } : undefined);
  const parsed = envSchema.parse(input ?? process.env);
  const baseDirectory = envFilePath ? dirname(envFilePath) : process.cwd();

  return {
    ...parsed,
    LINKEDIN_SESSION_STORAGE_DIR: resolvePath(baseDirectory, parsed.LINKEDIN_SESSION_STORAGE_DIR),
  };
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

function resolvePath(baseDirectory: string, value: string): string {
  return value.startsWith("/") ? value : join(baseDirectory, value);
}

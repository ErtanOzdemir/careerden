import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";
import { aiEnvShape, validateProductionAiEnv } from "@careerden/config";

export const llmWorkerEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
    ...aiEnvShape,
    LLM_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    LLM_WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3101),
  })
  .superRefine(validateProductionAiEnv);

export type LlmWorkerEnv = z.infer<typeof llmWorkerEnvSchema>;

export function loadLlmWorkerEnv(input = process.env): LlmWorkerEnv {
  const envFilePath = findNearestEnvFile();
  config(envFilePath ? { path: envFilePath } : undefined);

  return llmWorkerEnvSchema.parse(input);
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

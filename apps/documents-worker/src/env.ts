import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";
import {
  normalizeObjectStorageEnv,
  objectStorageEnvShape,
  validateProductionObjectStorageEnv,
} from "@careerden/config";

export const documentsWorkerEnvSchema = z.preprocess(
  normalizeObjectStorageEnv,
  z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      DATABASE_URL: z.string().min(1),
      REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
      DOCUMENTS_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
      GOTENBERG_URL: z.string().url().default("http://localhost:3002"),
      ...objectStorageEnvShape,
    })
    .superRefine(validateProductionObjectStorageEnv),
);

export type DocumentsWorkerEnv = z.infer<typeof documentsWorkerEnvSchema>;

export function loadDocumentsWorkerEnv(input = process.env): DocumentsWorkerEnv {
  const envFilePath = findNearestEnvFile();
  config(envFilePath ? { path: envFilePath } : undefined);

  return documentsWorkerEnvSchema.parse(input);
}

function findNearestEnvFile(startDirectory = process.cwd()): string | undefined {
  let currentDirectory = startDirectory;
  const rootDirectory = parse(startDirectory).root;

  while (true) {
    const candidate = join(currentDirectory, ".env");

    if (existsSync(candidate)) return candidate;
    if (currentDirectory === rootDirectory) return undefined;

    currentDirectory = dirname(currentDirectory);
  }
}

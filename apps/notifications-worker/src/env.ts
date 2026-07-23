import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";
import {
  normalizeObjectStorageEnv,
  objectStorageEnvShape,
  validateProductionObjectStorageEnv,
} from "@careerden/config";

export const notificationsWorkerEnvSchema = z.preprocess(
  normalizeObjectStorageEnv,
  z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      DATABASE_URL: z.string().min(1),
      REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
      SMTP_HOST: z.string().min(1).default("localhost"),
      SMTP_PORT: z.coerce.number().int().positive().default(1025),
      SMTP_FROM: z.string().min(1).default("Careerden <no-reply@careerden.local>"),
      NOTIFICATIONS_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
      NOTIFICATION_EMAIL_ENABLED: z
        .preprocess((value) => {
          if (value === "true") return true;
          if (value === "false") return false;
          return value;
        }, z.boolean())
        .default(false),
      ...objectStorageEnvShape,
    })
    .superRefine(validateProductionObjectStorageEnv),
);

export type NotificationsWorkerEnv = z.infer<typeof notificationsWorkerEnvSchema>;

export function loadNotificationsWorkerEnv(input = process.env): NotificationsWorkerEnv {
  const envFilePath = findNearestEnvFile();
  config(envFilePath ? { path: envFilePath } : undefined);

  return notificationsWorkerEnvSchema.parse(input);
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

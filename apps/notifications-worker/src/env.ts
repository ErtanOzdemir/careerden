import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";

export const notificationsWorkerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().min(1).default("Link2CV <no-reply@link2cv.local>"),
  NOTIFICATIONS_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  NOTIFICATION_EMAIL_ENABLED: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .default(false),
  RUSTFS_ENDPOINT: z.string().url().default("http://localhost:9000"),
  RUSTFS_BUCKET: z.string().min(1).default("link2cv"),
  RUSTFS_ACCESS_KEY_ID: z.string().min(1).default("rustfsadmin"),
  RUSTFS_SECRET_ACCESS_KEY: z.string().min(1).default("rustfsadmin"),
  RUSTFS_REGION: z.string().min(1).default("us-east-1"),
  RUSTFS_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
});

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

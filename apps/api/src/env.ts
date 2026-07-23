import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";
import {
  normalizeObjectStorageEnv,
  objectStorageEnvShape,
  validateProductionObjectStorageEnv,
  validateProductionSecret,
} from "@careerden/config";

const developmentBetterAuthSecret = "dev-only-careerden-better-auth-secret";

export const apiEnvSchema = z.preprocess(
  normalizeObjectStorageEnv,
  z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      PORT: z.coerce.number().int().positive().default(3000),
      DATABASE_URL: z.string().min(1),
      REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
      BETTER_AUTH_SECRET: z.string().min(16).default(developmentBetterAuthSecret),
      BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
      WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
      SMTP_HOST: z.string().min(1).default("localhost"),
      SMTP_PORT: z.coerce.number().int().positive().default(1025),
      SMTP_FROM: z.string().min(1).default("Careerden <no-reply@careerden.local>"),
      AI_PROVIDER: z.enum(["openai", "gemini", "deepseek"]).default("openai"),
      OPENAI_API_KEY: z.string().optional(),
      GEMINI_API_KEY: z.string().optional(),
      DEEPSEEK_API_KEY: z.string().optional(),
      GOTENBERG_URL: z.string().url().default("http://localhost:3002"),
      ...objectStorageEnvShape,
      OPEN_OBSERVE_URL: z.string().url().default("http://localhost:5080"),
      OPEN_OBSERVE_KEY: z.string().min(1),
    })
    .superRefine((env, context) => {
      validateProductionObjectStorageEnv(env, context);

      if (env.NODE_ENV === "production") {
        validateProductionSecret(
          {
            field: "BETTER_AUTH_SECRET",
            knownInsecureValues: [developmentBetterAuthSecret],
            value: env.BETTER_AUTH_SECRET,
          },
          context,
        );
      }
    }),
);

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

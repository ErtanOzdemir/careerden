import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { z } from "zod";
import {
  aiEnvShape,
  normalizeObjectStorageEnv,
  objectStorageEnvShape,
  validateProductionObjectStorageEnv,
  validateProductionResendEmailEnv,
  validateProductionAiEnv,
  validateProductionSecret,
} from "@careerden/config";

const developmentBetterAuthSecret = "dev-only-careerden-better-auth-secret";
const booleanFromEnv = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());
const commaSeparatedList = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

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
      AUTH_RATE_LIMIT_ENABLED: booleanFromEnv.default(true),
      AUTH_TRUSTED_PROXIES: commaSeparatedList,
      CREEM_API_KEY: z.string().min(1).optional(),
      CREEM_WEBHOOK_SECRET: z.string().min(16).optional(),
      CREEM_PRODUCT_ID: z.string().min(1).optional(),
      CREEM_PLAN_KEY: z.string().min(1).default("pro"),
      CREEM_SUCCESS_URL: z.string().url().optional(),
      CREEM_TEST_MODE: booleanFromEnv.default(true),
      SMTP_HOST: z.string().min(1).default("localhost"),
      SMTP_PORT: z.coerce.number().int().positive().default(1025),
      EMAIL_FROM: z.string().min(1).default("Careerden <no-reply@careerden.local>"),
      RESEND_API_KEY: z.string().default(""),
      ...aiEnvShape,
      ...objectStorageEnvShape,
      OPEN_OBSERVE_URL: z.string().url().default("http://localhost:5080"),
      OPEN_OBSERVE_KEY: z.string().min(1),
    })
    .superRefine((env, context) => {
      validateProductionObjectStorageEnv(env, context);
      validateProductionResendEmailEnv(env, context);
      validateProductionAiEnv(env, context);

      const creemFields = [
        ["CREEM_API_KEY", env.CREEM_API_KEY],
        ["CREEM_WEBHOOK_SECRET", env.CREEM_WEBHOOK_SECRET],
        ["CREEM_PRODUCT_ID", env.CREEM_PRODUCT_ID],
      ] as const;
      const creemConfigured = creemFields.some(([, value]) => Boolean(value));
      if (creemConfigured || env.NODE_ENV === "production") {
        for (const [field, value] of creemFields) {
          if (!value) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: `${field} is required when Creem billing is enabled`,
            });
          }
        }
      }
      if (env.NODE_ENV === "production" && env.CREEM_TEST_MODE) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CREEM_TEST_MODE"],
          message: "CREEM_TEST_MODE must be false in production",
        });
      }

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

export function isCreemConfigured(env: ApiEnv): env is ApiEnv & {
  CREEM_API_KEY: string;
  CREEM_WEBHOOK_SECRET: string;
  CREEM_PRODUCT_ID: string;
} {
  return Boolean(env.CREEM_API_KEY && env.CREEM_WEBHOOK_SECRET && env.CREEM_PRODUCT_ID);
}

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

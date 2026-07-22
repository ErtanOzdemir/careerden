import { z } from "zod";

const environmentBooleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const objectStorageEnvShape = {
  OBJECT_STORAGE_ENDPOINT: z.string().url().default("http://localhost:9000"),
  OBJECT_STORAGE_BUCKET: z.string().min(1).default("careerden"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).default("rustfsadmin"),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).default("rustfsadmin"),
  OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
  OBJECT_STORAGE_FORCE_PATH_STYLE: environmentBooleanSchema.default(true),
} satisfies z.ZodRawShape;

const legacyObjectStorageKeys = {
  OBJECT_STORAGE_ENDPOINT: "RUSTFS_ENDPOINT",
  OBJECT_STORAGE_BUCKET: "RUSTFS_BUCKET",
  OBJECT_STORAGE_ACCESS_KEY_ID: "RUSTFS_ACCESS_KEY_ID",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "RUSTFS_SECRET_ACCESS_KEY",
  OBJECT_STORAGE_REGION: "RUSTFS_REGION",
  OBJECT_STORAGE_FORCE_PATH_STYLE: "RUSTFS_FORCE_PATH_STYLE",
} as const;

export function normalizeObjectStorageEnv(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;

  const values = input as Record<string, unknown>;
  const normalized = { ...values };

  for (const [currentKey, legacyKey] of Object.entries(legacyObjectStorageKeys)) {
    if (normalized[currentKey] === undefined && values[legacyKey] !== undefined) {
      normalized[currentKey] = values[legacyKey];
    }
  }

  return normalized;
}

import { Buffer } from "node:buffer";
import type { RefinementCtx } from "zod";
import { z } from "zod";

export const minimumProductionSecretBytes = 32;

const insecureObjectStorageAccessKeys = new Set(["minioadmin", "rustfsadmin"]);
const insecureObjectStorageSecretKeys = new Set(["minioadmin", "rustfsadmin"]);
const localObjectStorageHostnames = new Set(["0.0.0.0", "[::1]", "localhost"]);

export function validateProductionSecret(
  input: {
    field: string;
    knownInsecureValues?: readonly string[];
    value: string;
  },
  context: RefinementCtx,
): void {
  const normalizedValue = input.value.trim();
  const knownInsecureValues = new Set(
    input.knownInsecureValues?.map((value) => value.trim().toLowerCase()) ?? [],
  );

  if (knownInsecureValues.has(normalizedValue.toLowerCase())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${input.field} must not use a known development default in production`,
      path: [input.field],
    });
  }

  if (Buffer.byteLength(normalizedValue, "utf8") < minimumProductionSecretBytes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${input.field} must contain at least ${minimumProductionSecretBytes} UTF-8 bytes in production`,
      path: [input.field],
    });
  }
}

export function validateProductionObjectStorageEnv(
  input: {
    NODE_ENV: "development" | "test" | "production";
    OBJECT_STORAGE_ACCESS_KEY_ID: string;
    OBJECT_STORAGE_ENDPOINT: string;
    OBJECT_STORAGE_SECRET_ACCESS_KEY: string;
  },
  context: RefinementCtx,
): void {
  if (input.NODE_ENV !== "production") {
    return;
  }

  const endpoint = new URL(input.OBJECT_STORAGE_ENDPOINT);
  const hostname = endpoint.hostname.toLowerCase();

  if (
    localObjectStorageHostnames.has(hostname) ||
    hostname.startsWith("127.") ||
    hostname.endsWith(".localhost")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OBJECT_STORAGE_ENDPOINT must not target localhost in production",
      path: ["OBJECT_STORAGE_ENDPOINT"],
    });
  }

  if (
    insecureObjectStorageAccessKeys.has(input.OBJECT_STORAGE_ACCESS_KEY_ID.trim().toLowerCase())
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "OBJECT_STORAGE_ACCESS_KEY_ID must not use a known development default in production",
      path: ["OBJECT_STORAGE_ACCESS_KEY_ID"],
    });
  }

  validateProductionSecret(
    {
      field: "OBJECT_STORAGE_SECRET_ACCESS_KEY",
      knownInsecureValues: [...insecureObjectStorageSecretKeys],
      value: input.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    },
    context,
  );
}

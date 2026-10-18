import { Buffer } from "node:buffer";
import type { RefinementCtx } from "zod";
import { z } from "zod";

export const minimumProductionSecretBytes = 32;

const insecureObjectStorageAccessKeys = new Set(["minioadmin", "rustfsadmin"]);
const insecureObjectStorageSecretKeys = new Set(["minioadmin", "rustfsadmin"]);
const localHostnames = new Set(["0.0.0.0", "[::1]", "localhost"]);

export interface ProductionResendEmailEnv {
  NODE_ENV: "development" | "test" | "production";
  EMAIL_FROM: string;
  RESEND_API_KEY?: string;
  emailRequired?: boolean;
}

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

  if (isLocalUrl(input.OBJECT_STORAGE_ENDPOINT)) {
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

export function validateProductionResendEmailEnv(
  input: ProductionResendEmailEnv,
  context: RefinementCtx,
): void {
  if (input.NODE_ENV !== "production" || input.emailRequired === false) {
    return;
  }

  if (!input.RESEND_API_KEY?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RESEND_API_KEY is required for production email delivery",
      path: ["RESEND_API_KEY"],
    });
  }

  const emailAddress = extractEmailAddress(input.EMAIL_FROM);
  const parsedEmail = z.string().email().safeParse(emailAddress);
  if (!parsedEmail.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "EMAIL_FROM must contain a valid sender email address",
      path: ["EMAIL_FROM"],
    });
    return;
  }

  const domain = parsedEmail.data.slice(parsedEmail.data.lastIndexOf("@") + 1).toLowerCase();
  if (domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".local")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "EMAIL_FROM must use a non-local sender domain in production",
      path: ["EMAIL_FROM"],
    });
  }
}

export function isLocalUrl(value: string): boolean {
  const hostname = new URL(value).hostname.toLowerCase();
  return (
    localHostnames.has(hostname) || hostname.startsWith("127.") || hostname.endsWith(".localhost")
  );
}

function extractEmailAddress(sender: string): string {
  const normalizedSender = sender.trim();
  const angleAddress = normalizedSender.match(/<([^<>]+)>$/);
  return (angleAddress?.[1] ?? normalizedSender).trim();
}

import type { RefinementCtx } from "zod";
import { z } from "zod";
import { isLocalUrl, validateProductionSecret } from "./production-secrets.js";

export const developmentOpencodeServerPassword = "dev-only-careerden-opencode-password";

export const aiEnvShape = {
  AI_PROVIDER: z.enum(["openai", "gemini", "deepseek"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  AI_FREE_PROVIDER: z.enum(["opencode", "premium"]).default("opencode"),
  OPENCODE_BASE_URL: z.string().url().default("http://localhost:4096"),
  OPENCODE_SERVER_USERNAME: z.string().min(1).default("opencode"),
  OPENCODE_SERVER_PASSWORD: z.string().min(1).default(developmentOpencodeServerPassword),
  OPENCODE_FREE_MODEL: z.string().min(1).default("space-bunny-free"),
  /** Reasoning-effort variant; `low` keeps analyses fast. Empty keeps the model default. */
  OPENCODE_FREE_MODEL_VARIANT: z.string().default("low"),
  /**
   * OpenCode agent for free-tier requests. `careerden` is the tool-free production agent; `build`
   * is OpenCode's coding agent, allowed only for local experiments with test data.
   */
  OPENCODE_AGENT: z.string().min(1).default("careerden"),
  OPENCODE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
};

export interface AiEnv {
  NODE_ENV: "development" | "test" | "production";
  AI_PROVIDER: "openai" | "gemini" | "deepseek";
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  AI_FREE_PROVIDER: "opencode" | "premium";
  OPENCODE_BASE_URL: string;
  OPENCODE_SERVER_USERNAME: string;
  OPENCODE_SERVER_PASSWORD: string;
  OPENCODE_FREE_MODEL: string;
  OPENCODE_FREE_MODEL_VARIANT: string;
  OPENCODE_AGENT: string;
  OPENCODE_TIMEOUT_MS: number;
}

export function validateProductionAiEnv(input: AiEnv, context: RefinementCtx): void {
  if (input.NODE_ENV !== "production" || input.AI_FREE_PROVIDER !== "opencode") return;

  if (input.OPENCODE_AGENT !== "careerden") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OPENCODE_AGENT must be the tool-free careerden agent in production",
      path: ["OPENCODE_AGENT"],
    });
  }
  if (isLocalUrl(input.OPENCODE_BASE_URL)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OPENCODE_BASE_URL must not target localhost in production",
      path: ["OPENCODE_BASE_URL"],
    });
  }
  validateProductionSecret(
    {
      field: "OPENCODE_SERVER_PASSWORD",
      knownInsecureValues: [developmentOpencodeServerPassword],
      value: input.OPENCODE_SERVER_PASSWORD,
    },
    context,
  );
}

/** Maps validated environment variables to the infrastructure `AiProviderConfig` shape. */
export function aiProviderConfigFromEnv(env: AiEnv) {
  return {
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    freeAiProvider: env.AI_FREE_PROVIDER,
    opencode: {
      baseUrl: env.OPENCODE_BASE_URL,
      username: env.OPENCODE_SERVER_USERNAME,
      password: env.OPENCODE_SERVER_PASSWORD,
      model: env.OPENCODE_FREE_MODEL,
      variant: env.OPENCODE_FREE_MODEL_VARIANT || undefined,
      agent: env.OPENCODE_AGENT,
      timeoutMs: env.OPENCODE_TIMEOUT_MS,
    },
  };
}

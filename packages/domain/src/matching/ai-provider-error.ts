import { aiProviderFailureCategories } from "@careerden/contracts";

// The categories are shared with the web app through the contracts package.
export const aiProviderErrorCategories = aiProviderFailureCategories;

export type AiProviderErrorCategory = (typeof aiProviderErrorCategories)[number];

// What is persisted and shown for a failed AI call. Never holds the key or prompt content.
export interface AiProviderFailure {
  category: AiProviderErrorCategory;
  provider?: string;
  statusCode?: number;
}

export const aiProviderErrorMessages: Record<AiProviderErrorCategory, string> = {
  invalid_api_key: "Your API key is invalid or revoked. Update it in Settings.",
  insufficient_quota: "Your provider account has no balance or quota left.",
  rate_limited: "The provider is temporarily limiting requests. Try again in a few minutes.",
  model_unavailable: "The selected model is no longer available.",
  provider_unavailable: "The AI provider could not be reached. Try again in a few minutes.",
  invalid_output: "The AI model returned a response Careerden could not use. Try again.",
};

// Waiting fixes these; a bad key, an empty balance, a removed model, or unusable output does not.
const retryableCategories: ReadonlySet<AiProviderErrorCategory> = new Set([
  "rate_limited",
  "provider_unavailable",
]);

export function isRetryableAiProviderErrorCategory(category: AiProviderErrorCategory): boolean {
  return retryableCategories.has(category);
}

export function isAiProviderErrorCategory(value: unknown): value is AiProviderErrorCategory {
  return (
    typeof value === "string" && (aiProviderErrorCategories as readonly string[]).includes(value)
  );
}

/**
 * A provider failure translated into a category the user can act on. It deliberately carries no
 * `cause`: provider SDK errors hold the request body (the prompt) and sometimes echo the API key,
 * and anything attached here ends up in logs.
 */
export class AiProviderError extends Error {
  readonly category: AiProviderErrorCategory;
  readonly provider?: string;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(failure: AiProviderFailure, options: { retryable?: boolean; message?: string } = {}) {
    super(options.message ?? aiProviderErrorMessages[failure.category]);
    this.name = "AiProviderError";
    this.category = failure.category;
    if (failure.provider) this.provider = failure.provider;
    if (failure.statusCode !== undefined) this.statusCode = failure.statusCode;
    this.retryable = options.retryable ?? isRetryableAiProviderErrorCategory(failure.category);
  }

  toFailure(): AiProviderFailure {
    return {
      category: this.category,
      ...(this.provider ? { provider: this.provider } : {}),
      ...(this.statusCode !== undefined ? { statusCode: this.statusCode } : {}),
    };
  }
}

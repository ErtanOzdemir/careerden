import { AiProviderError } from "@careerden/domain";
import type { AiProviderErrorCategory } from "@careerden/domain";
import {
  APICallError,
  JSONParseError,
  LoadAPIKeyError,
  NoContentGeneratedError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  NoSuchModelError,
  RetryError,
  TypeValidationError,
} from "ai";
import { ZodError } from "zod";
import { AiOutputValidationError } from "./ai-output-validation.error.js";

// Matched against the provider's message and response body. Order matters: OpenAI reports an
// empty balance as a 429 and Anthropic as a 400, so balance wording is checked before status codes.
// Gemini words its per-minute 429s as "exceeded your current quota", so that phrase is not here.
const insufficientQuotaPattern =
  /insufficient[_ ]quota|insufficient[_ ]balance|insufficient[_ ]credits|credit balance is too low|payment[_ ]required|requires more credits|billing[_ ]hard[_ ]limit/;
const invalidApiKeyPattern =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|api[_ ]key[_ ]invalid|api key expired|invalid x-api-key|authentication[_ ]error|no auth credentials|user not found/;
// DeepSeek answers an unknown model with a 400 that lists the models it supports.
const modelUnavailablePattern =
  /model[_ ]not[_ ]found|model[^.\n]{0,80}(?:not found|does not exist|not exist|is not a valid|not available|not supported|decommissioned|deprecated)|no endpoints found|invalid model|unknown model|supported (?:api )?model names/;
const networkErrorCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/**
 * Translates a Vercel AI SDK failure into a domain `AiProviderError`. Returns undefined for errors
 * that did not come from the provider call, such as programming errors, so they surface unchanged.
 */
export function toAiProviderError(error: unknown, provider: string): AiProviderError | undefined {
  if (error instanceof AiProviderError) return error;
  // The SDK retries 429 and 5xx responses itself and reports the last one.
  if (RetryError.isInstance(error)) return toAiProviderError(error.lastError, provider);
  if (LoadAPIKeyError.isInstance(error)) {
    return new AiProviderError({ category: "invalid_api_key", provider });
  }
  if (NoSuchModelError.isInstance(error)) {
    return new AiProviderError({ category: "model_unavailable", provider });
  }
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoContentGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error) ||
    error instanceof ZodError
  ) {
    return new AiOutputValidationError(error, provider);
  }
  if (APICallError.isInstance(error)) return fromApiCallError(error, provider);
  if (isNetworkError(error)) {
    return new AiProviderError({ category: "provider_unavailable", provider });
  }
  return undefined;
}

function fromApiCallError(error: APICallError, provider: string): AiProviderError {
  const statusCode = error.statusCode;
  const text = `${error.message}\n${error.responseBody ?? ""}`.slice(0, 4_000).toLowerCase();
  const failure = (category: AiProviderErrorCategory, retryable?: boolean) =>
    new AiProviderError(
      { category, provider, ...(statusCode !== undefined ? { statusCode } : {}) },
      retryable === undefined ? {} : { retryable },
    );

  if (statusCode === undefined) return failure("provider_unavailable");
  if (statusCode === 402 || insufficientQuotaPattern.test(text)) {
    return failure("insufficient_quota");
  }
  if (statusCode === 401 || statusCode === 403 || invalidApiKeyPattern.test(text)) {
    return failure("invalid_api_key");
  }
  if (statusCode === 404 || modelUnavailablePattern.test(text)) {
    return failure("model_unavailable");
  }
  if (statusCode === 429) return failure("rate_limited");
  if (statusCode === 408 || statusCode >= 500) return failure("provider_unavailable");
  // Any other rejected request: retrying the same payload will not change the answer.
  return failure("provider_unavailable", false);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && networkErrorCodes.has(code)) return true;
  if (error instanceof TypeError && error.message === "fetch failed") return true;
  return error.cause !== undefined && error.cause !== error && isNetworkError(error.cause);
}

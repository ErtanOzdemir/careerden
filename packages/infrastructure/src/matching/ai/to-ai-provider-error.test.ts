import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiProviderError } from "@careerden/domain";
import {
  APICallError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  NoSuchModelError,
  RetryError,
} from "ai";
import { AiOutputValidationError } from "./ai-output-validation.error.js";
import { toAiProviderError } from "./to-ai-provider-error.js";

function apiCallError(statusCode: number | undefined, responseBody: string, message = "Bad") {
  return new APICallError({
    message,
    url: "https://provider.example/v1/chat",
    requestBodyValues: { messages: [{ role: "user", content: "secret prompt" }] },
    ...(statusCode !== undefined ? { statusCode } : {}),
    responseBody,
    isRetryable: statusCode === undefined || statusCode === 429 || statusCode >= 500,
  });
}

// Response bodies follow each provider's documented error format.
const cases: Array<[string, string, number | undefined, string, string]> = [
  // OpenAI
  [
    "openai",
    "invalid_api_key",
    401,
    '{"error":{"message":"Incorrect API key provided: sk-abc***xyz.","type":"invalid_request_error","code":"invalid_api_key"}}',
    "Incorrect API key provided",
  ],
  [
    "openai",
    "insufficient_quota",
    429,
    '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}',
    "You exceeded your current quota",
  ],
  [
    "openai",
    "rate_limited",
    429,
    '{"error":{"message":"Rate limit reached for gpt-4.1-mini on requests per min.","type":"requests","code":"rate_limit_exceeded"}}',
    "Rate limit reached",
  ],
  [
    "openai",
    "model_unavailable",
    404,
    '{"error":{"message":"The model `gpt-9` does not exist or you do not have access to it.","code":"model_not_found"}}',
    "The model does not exist",
  ],
  ["openai", "provider_unavailable", 503, '{"error":{"message":"Service unavailable"}}', "Down"],
  // Gemini
  [
    "gemini",
    "invalid_api_key",
    400,
    '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}',
    "API key not valid. Please pass a valid API key.",
  ],
  [
    "gemini",
    "invalid_api_key",
    403,
    '{"error":{"code":403,"message":"Permission denied.","status":"PERMISSION_DENIED"}}',
    "Permission denied.",
  ],
  [
    "gemini",
    "rate_limited",
    429,
    '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}',
    "You exceeded your current quota",
  ],
  [
    "gemini",
    "model_unavailable",
    404,
    '{"error":{"code":404,"message":"models/gemini-1.0-pro is not found for API version v1beta.","status":"NOT_FOUND"}}',
    "models/gemini-1.0-pro is not found",
  ],
  [
    "gemini",
    "provider_unavailable",
    503,
    '{"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}',
    "The model is overloaded.",
  ],
  // DeepSeek
  [
    "deepseek",
    "invalid_api_key",
    401,
    '{"error":{"message":"Authentication Fails, Your api key: ****abcd is invalid","type":"authentication_error","code":"invalid_request_error"}}',
    "Authentication Fails",
  ],
  [
    "deepseek",
    "insufficient_quota",
    402,
    '{"error":{"message":"Insufficient Balance","type":"unknown_error"}}',
    "Insufficient Balance",
  ],
  [
    "deepseek",
    "model_unavailable",
    400,
    '{"error":{"message":"Model Not Exist","type":"invalid_request_error"}}',
    "Model Not Exist",
  ],
  [
    "deepseek",
    "model_unavailable",
    400,
    // Captured from the DeepSeek API for a model ID it does not serve.
    '{"error":{"message":"The supported API model names are deepseek-flash, deepseek-v4-pro, but you passed deepseek-retired-qa-model. (request_id: decbcb3a-a2dd-4b30-b0d7-ae4f421815b2)","type":"invalid_request_error","param":null,"code":"invalid_request_error"}}',
    "The supported API model names are deepseek-flash, deepseek-v4-pro, but you passed deepseek-retired-qa-model. (request_id: decbcb3a-a2dd-4b30-b0d7-ae4f421815b2)",
  ],
  ["deepseek", "rate_limited", 429, '{"error":{"message":"Rate Limit Reached"}}', "Rate limit"],
  ["deepseek", "provider_unavailable", 500, '{"error":{"message":"Server Error"}}', "Error"],
  // Anthropic
  [
    "anthropic",
    "invalid_api_key",
    401,
    '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
    "invalid x-api-key",
  ],
  [
    "anthropic",
    "insufficient_quota",
    400,
    '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
    "Your credit balance is too low to access the Anthropic API.",
  ],
  [
    "anthropic",
    "rate_limited",
    429,
    '{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}',
    "Number of request tokens has exceeded your per-minute rate limit",
  ],
  [
    "anthropic",
    "model_unavailable",
    404,
    '{"type":"error","error":{"type":"not_found_error","message":"model: claude-2.0"}}',
    "model: claude-2.0",
  ],
  [
    "anthropic",
    "provider_unavailable",
    529,
    '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    "Overloaded",
  ],
  // OpenRouter
  [
    "openrouter",
    "invalid_api_key",
    401,
    '{"error":{"message":"No auth credentials found","code":401}}',
    "No auth credentials found",
  ],
  [
    "openrouter",
    "insufficient_quota",
    402,
    '{"error":{"message":"This request requires more credits, or fewer max_tokens.","code":402}}',
    "This request requires more credits",
  ],
  [
    "openrouter",
    "model_unavailable",
    400,
    '{"error":{"message":"vendor/removed-model is not a valid model ID","code":400}}',
    "vendor/removed-model is not a valid model ID",
  ],
  [
    "openrouter",
    "model_unavailable",
    404,
    '{"error":{"message":"No endpoints found matching your data policy.","code":404}}',
    "No endpoints found matching your data policy.",
  ],
  [
    "openrouter",
    "rate_limited",
    429,
    '{"error":{"message":"Rate limit exceeded: free-models-per-min.","code":429}}',
    "Rate limit exceeded",
  ],
  [
    "openrouter",
    "provider_unavailable",
    502,
    '{"error":{"message":"Provider returned error","code":502}}',
    "Provider returned error",
  ],
];

describe("toAiProviderError", () => {
  it.each(cases)("maps %s errors to %s (HTTP %s)", (provider, category, status, body, message) => {
    const result = toAiProviderError(apiCallError(status, body, message), provider);

    expect(result).toBeInstanceOf(AiProviderError);
    expect(result?.toFailure()).toEqual({ category, provider, statusCode: status });
  });

  it("marks only rate limits and outages as retryable", () => {
    const retryable = (status: number, body: string) =>
      toAiProviderError(apiCallError(status, body), "openai")?.retryable;

    expect(retryable(429, "rate limited")).toBe(true);
    expect(retryable(503, "unavailable")).toBe(true);
    expect(retryable(401, "bad key")).toBe(false);
    expect(retryable(402, "no balance")).toBe(false);
    expect(retryable(404, "no model")).toBe(false);
    expect(retryable(400, "some other rejected request")).toBe(false);
  });

  it("treats a request that never got a response as the provider being unavailable", () => {
    const result = toAiProviderError(apiCallError(undefined, ""), "deepseek");

    expect(result?.toFailure()).toEqual({ category: "provider_unavailable", provider: "deepseek" });
    expect(result?.retryable).toBe(true);
  });

  it("maps network failures and timeouts outside an API call", () => {
    const fetchFailed = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });
    const timeout = Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });

    expect(toAiProviderError(fetchFailed, "openai")?.category).toBe("provider_unavailable");
    expect(toAiProviderError(timeout, "openai")?.category).toBe("provider_unavailable");
  });

  it("unwraps the SDK's retry error to classify the last attempt", () => {
    const error = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiCallError(503, "down"), apiCallError(429, "slow down")],
    });

    expect(toAiProviderError(error, "anthropic")?.toFailure()).toEqual({
      category: "rate_limited",
      provider: "anthropic",
      statusCode: 429,
    });
  });

  it("maps a missing key and an unknown model", () => {
    expect(
      toAiProviderError(new LoadAPIKeyError({ message: "OpenAI API key is missing." }), "openai")
        ?.category,
    ).toBe("invalid_api_key");
    expect(
      toAiProviderError(
        new NoSuchModelError({ modelId: "gpt-9", modelType: "languageModel" }),
        "openai",
      )?.category,
    ).toBe("model_unavailable");
  });

  it("maps output that failed the schema to invalid_output, keeping the model text off the message", () => {
    const schemaError = z.object({ ok: z.boolean() }).safeParse({ ok: "yes" }).error;
    const noObject = new NoObjectGeneratedError({
      message: "No object generated",
      text: '{"ok":"yes"}',
      response: { id: "r", timestamp: new Date(0), modelId: "m" },
      usage: {
        inputTokens: 1,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: 1,
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        totalTokens: 2,
      },
      finishReason: "stop",
    });

    const fromZod = toAiProviderError(schemaError, "gemini");
    const fromSdk = toAiProviderError(noObject, "gemini");

    expect(fromZod).toBeInstanceOf(AiOutputValidationError);
    expect(fromZod?.toFailure()).toEqual({ category: "invalid_output", provider: "gemini" });
    expect(fromSdk).toMatchObject({ category: "invalid_output", modelText: '{"ok":"yes"}' });
    expect(fromSdk?.message).not.toContain('{"ok":"yes"}');
    expect(fromSdk?.retryable).toBe(false);
  });

  it("never carries the request body, prompt, or key into the mapped error", () => {
    const result = toAiProviderError(
      apiCallError(401, '{"error":{"message":"Incorrect API key provided: sk-live-1234567890"}}'),
      "openai",
    );

    const serialized = JSON.stringify({
      ...result,
      message: result?.message,
      cause: result?.cause,
    });
    expect(serialized).not.toContain("secret prompt");
    expect(serialized).not.toContain("sk-live");
    expect(result?.message).toBe("Your API key is invalid or revoked. Update it in Settings.");
  });

  it("leaves errors that did not come from the provider untouched", () => {
    expect(toAiProviderError(new Error("bug"), "openai")).toBeUndefined();
  });
});

import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { AiProviderError } from "@careerden/domain";
import { AiOutputValidationError } from "./ai-output-validation.error.js";
import { isModelUnavailableError } from "./model-unavailable-error.js";

function apiError(statusCode: number, message: string, responseBody?: string): APICallError {
  return new APICallError({
    message,
    url: "https://provider.example/v1",
    requestBodyValues: {},
    statusCode,
    ...(responseBody ? { responseBody } : {}),
  });
}

describe("isModelUnavailableError", () => {
  it.each([
    [
      "OpenAI model_not_found",
      apiError(404, "The model `gpt-retired` does not exist or you do not have access to it."),
    ],
    ["Anthropic not_found_error", apiError(404, "model: claude-retired")],
    [
      "Gemini unknown model",
      apiError(404, "models/gemini-retired is not found for API version v1beta"),
    ],
    ["DeepSeek missing model", apiError(400, "Model Not Exist")],
    ["OpenRouter invalid model", apiError(400, "vendor/retired is not a valid model ID")],
    [
      "a deprecation notice in the body",
      apiError(400, "Bad Request", '{"error":{"message":"The model has been decommissioned"}}'),
    ],
  ])("recognizes %s", (_label, error) => {
    expect(isModelUnavailableError(error)).toBe(true);
  });

  it("recognizes the provider clients' model_unavailable error and no other category", () => {
    expect(
      isModelUnavailableError(
        new AiProviderError({ category: "model_unavailable", provider: "openai", statusCode: 404 }),
      ),
    ).toBe(true);
    expect(isModelUnavailableError(new AiProviderError({ category: "invalid_api_key" }))).toBe(
      false,
    );
    expect(isModelUnavailableError(new AiProviderError({ category: "rate_limited" }))).toBe(false);
  });

  it("looks through Careerden's validation error and the AI SDK retry error", () => {
    const retired = apiError(404, "model: claude-retired");
    const retry = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [retired],
    });

    expect(isModelUnavailableError(new AiOutputValidationError(retired))).toBe(true);
    expect(isModelUnavailableError(retry)).toBe(true);
  });

  it.each([
    ["an invalid key", apiError(401, "Incorrect API key provided")],
    ["a rate limit", apiError(429, "Rate limit reached for model gpt-4.1-mini")],
    ["a context limit", apiError(400, "This model's maximum context length is 128000 tokens")],
    ["a 404 that does not mention a model", apiError(404, "Not Found")],
    ["a non-API error", new Error("model not found")],
  ])("ignores %s", (_label, error) => {
    expect(isModelUnavailableError(error)).toBe(false);
  });
});

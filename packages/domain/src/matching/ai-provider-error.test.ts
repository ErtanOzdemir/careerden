import { describe, expect, it } from "vitest";
import {
  AiProviderError,
  aiProviderErrorCategories,
  aiProviderErrorMessages,
  isAiProviderErrorCategory,
} from "./ai-provider-error.js";

describe("AiProviderError", () => {
  it("gives every category its own message", () => {
    const messages = aiProviderErrorCategories.map((category) => aiProviderErrorMessages[category]);

    expect(new Set(messages).size).toBe(aiProviderErrorCategories.length);
  });

  it("retries only rate limits and outages by default", () => {
    const retryable = aiProviderErrorCategories.filter(
      (category) => new AiProviderError({ category }).retryable,
    );

    expect(retryable).toEqual(["rate_limited", "provider_unavailable"]);
    expect(new AiProviderError({ category: "rate_limited" }, { retryable: false }).retryable).toBe(
      false,
    );
  });

  it("exposes only the category, provider, and status code as failure details", () => {
    const error = new AiProviderError({
      category: "invalid_api_key",
      provider: "anthropic",
      statusCode: 401,
    });

    expect(error.message).toBe("Your API key is invalid or revoked. Update it in Settings.");
    expect(error.toFailure()).toEqual({
      category: "invalid_api_key",
      provider: "anthropic",
      statusCode: 401,
    });
    expect(new AiProviderError({ category: "invalid_output" }).toFailure()).toEqual({
      category: "invalid_output",
    });
    expect(error.cause).toBeUndefined();
  });

  it("recognizes category strings", () => {
    expect(isAiProviderErrorCategory("model_unavailable")).toBe(true);
    expect(isAiProviderErrorCategory("exploded")).toBe(false);
    expect(isAiProviderErrorCategory(undefined)).toBe(false);
  });
});

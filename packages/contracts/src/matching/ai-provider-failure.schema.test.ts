import { describe, expect, it } from "vitest";
import { aiProviderFailureSchema } from "./ai-provider-failure.schema.js";

describe("aiProviderFailureSchema", () => {
  it("accepts a category with optional provider and status code", () => {
    expect(
      aiProviderFailureSchema.parse({
        category: "rate_limited",
        provider: "gemini",
        statusCode: 429,
      }),
    ).toEqual({ category: "rate_limited", provider: "gemini", statusCode: 429 });
    expect(aiProviderFailureSchema.parse({ category: "invalid_output" })).toEqual({
      category: "invalid_output",
    });
  });

  it("rejects unknown categories and impossible status codes", () => {
    expect(aiProviderFailureSchema.safeParse({ category: "exploded" }).success).toBe(false);
    expect(
      aiProviderFailureSchema.safeParse({ category: "rate_limited", statusCode: 42 }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { AiProviderFactory, createAiProvider } from "./ai-provider.factory.js";
import { AnthropicAiProvider } from "./providers/anthropic-ai.provider.js";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";

describe("createAiProvider", () => {
  it.each([
    ["openai", OpenAiAiProvider],
    ["gemini", GeminiAiProvider],
    ["deepseek", DeepSeekAiProvider],
    ["anthropic", AnthropicAiProvider],
  ] as const)("creates the %s provider", (provider, expected) => {
    expect(createAiProvider({ provider, apiKey: "key" })).toBeInstanceOf(expected);
  });

  it("uses an explicit model and falls back to the default for a blank one", () => {
    expect(
      createAiProvider({ provider: "anthropic", apiKey: "key", model: "claude-sonnet-5-5" }),
    ).toMatchObject({ model: "claude-sonnet-5-5" });
    expect(createAiProvider({ provider: "anthropic", apiKey: "key", model: "  " })).toMatchObject({
      model: "claude-haiku-5-5",
    });
  });
});

describe("AiProviderFactory", () => {
  it("creates the configured provider when its key is present", () => {
    expect(
      new AiProviderFactory({ aiProvider: "anthropic", anthropicApiKey: "key" }).create(),
    ).toBeInstanceOf(AnthropicAiProvider);
  });

  it("rejects a provider without a key or an unknown provider", () => {
    expect(() => new AiProviderFactory({ aiProvider: "anthropic" }).create()).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(() =>
      new AiProviderFactory({ aiProvider: "unknown", openaiApiKey: "key" }).create(),
    ).toThrow(/No AI provider configured for "unknown"/);
  });
});

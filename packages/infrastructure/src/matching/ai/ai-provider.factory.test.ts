import { describe, expect, it } from "vitest";
import { embeddedAiModelCatalog } from "@careerden/contracts";
import {
  aiModelCandidates,
  AiProviderFactory,
  createAiProvider,
  createAiProviderForModel,
} from "./ai-provider.factory.js";
import { AnthropicAiProvider } from "./providers/anthropic-ai.provider.js";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";
import { OpenRouterAiProvider } from "./providers/openrouter-ai.provider.js";

describe("createAiProviderForModel", () => {
  it.each([
    ["openai", OpenAiAiProvider],
    ["gemini", GeminiAiProvider],
    ["deepseek", DeepSeekAiProvider],
    ["anthropic", AnthropicAiProvider],
    ["openrouter", OpenRouterAiProvider],
  ] as const)("creates the %s provider for one model", (provider, expected) => {
    const created = createAiProviderForModel(provider, "key", "model-1");

    expect(created).toBeInstanceOf(expected);
    expect(created).toMatchObject({ model: "model-1" });
  });
});

describe("createAiProvider", () => {
  it("tries the embedded recommended model, then its fallbacks", () => {
    expect(createAiProvider({ provider: "anthropic", apiKey: "key" })).toMatchObject({
      provider: "anthropic",
      models: [
        embeddedAiModelCatalog.providers.anthropic.recommended,
        ...embeddedAiModelCatalog.providers.anthropic.fallbacks,
      ],
    });
  });

  it("puts an explicit model first and ignores a blank one", () => {
    expect(
      createAiProvider({ provider: "anthropic", apiKey: "key", model: "claude-sonnet-5-5" }).model,
    ).toBe("claude-sonnet-5-5");
    expect(createAiProvider({ provider: "anthropic", apiKey: "key", model: "  " }).model).toBe(
      embeddedAiModelCatalog.providers.anthropic.recommended,
    );
  });

  it("uses the catalog models from the selection instead of the embedded ones", () => {
    expect(
      aiModelCandidates({
        provider: "openai",
        apiKey: "key",
        model: "gpt-5",
        models: { recommended: "gpt-5", fallbacks: ["gpt-5-mini", "gpt-5"] },
      }),
    ).toEqual(["gpt-5", "gpt-5-mini"]);
  });
});

describe("AiProviderFactory", () => {
  it("creates the configured provider when its key is present", () => {
    expect(
      new AiProviderFactory({ aiProvider: "anthropic", anthropicApiKey: "key" }).create(),
    ).toMatchObject({ provider: "anthropic" });
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

describe("OpenRouterAiProvider", () => {
  it("accepts any user-supplied model id and defaults to OpenRouter's router", () => {
    expect(
      createAiProvider({
        provider: "openrouter",
        apiKey: "key",
        model: "thinkingmachines/inkling-small:free",
      }),
    ).toMatchObject({ models: ["thinkingmachines/inkling-small:free", "openrouter/auto"] });
    expect(createAiProvider({ provider: "openrouter", apiKey: "key" })).toMatchObject({
      models: ["openrouter/auto"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { AiProviderFactory } from "./ai-provider.factory.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpencodeAiProvider } from "./providers/opencode-ai.provider.js";
import { TieredAiProvider } from "./providers/tiered-ai.provider.js";

const opencode = {
  baseUrl: "http://localhost:4096",
  username: "opencode",
  password: "secret",
  model: "deepseek-v4.1-flash-free",
  timeoutMs: 5_000,
  agent: "careerden",
};

function tiers(provider: unknown) {
  expect(provider).toBeInstanceOf(TieredAiProvider);
  return (provider as unknown as { providers: Record<"free" | "premium", unknown> }).providers;
}

describe("AiProviderFactory", () => {
  it("uses OpenCode for free users and the configured paid provider for subscribers", () => {
    const providers = tiers(
      new AiProviderFactory({
        aiProvider: "gemini",
        geminiApiKey: "key",
        freeAiProvider: "opencode",
        opencode,
      }).create(),
    );

    expect(providers.free).toBeInstanceOf(OpencodeAiProvider);
    expect(providers.premium).toBeInstanceOf(GeminiAiProvider);
  });

  it("can reuse the paid provider for free users", () => {
    const providers = tiers(
      new AiProviderFactory({
        aiProvider: "gemini",
        geminiApiKey: "key",
        freeAiProvider: "premium",
      }).create(),
    );

    expect(providers.free).toBe(providers.premium);
  });

  it("requires an OpenCode password when free users use OpenCode", () => {
    expect(() =>
      new AiProviderFactory({
        aiProvider: "gemini",
        geminiApiKey: "key",
        freeAiProvider: "opencode",
        opencode: { ...opencode, password: "" },
      }).create(),
    ).toThrow("OPENCODE_SERVER_PASSWORD");
  });

  it("requires the paid provider's API key", () => {
    expect(() =>
      new AiProviderFactory({ aiProvider: "deepseek", freeAiProvider: "opencode", opencode }).create(),
    ).toThrow('No AI provider configured for "deepseek"');
  });
});

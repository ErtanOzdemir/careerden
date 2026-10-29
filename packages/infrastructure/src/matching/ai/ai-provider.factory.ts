import type { AiProvider } from "@careerden/domain";
import { AnthropicAiProvider } from "./providers/anthropic-ai.provider.js";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";
import { OpenRouterAiProvider } from "./providers/openrouter-ai.provider.js";

export const aiProviderNames = ["openai", "gemini", "deepseek", "anthropic", "openrouter"] as const;
export type AiProviderName = (typeof aiProviderNames)[number];

export interface AiProviderSelection {
  provider: AiProviderName;
  apiKey: string;
  // Omit to use the provider's default model.
  model?: string;
}

export function createAiProvider(selection: AiProviderSelection): AiProvider {
  const model = selection.model?.trim() || undefined;
  switch (selection.provider) {
    case "openai":
      return new OpenAiAiProvider(selection.apiKey, model);
    case "gemini":
      return new GeminiAiProvider(selection.apiKey, model);
    case "deepseek":
      return new DeepSeekAiProvider(selection.apiKey, model);
    case "anthropic":
      return new AnthropicAiProvider(selection.apiKey, model);
    case "openrouter":
      return new OpenRouterAiProvider(selection.apiKey, model);
  }
}

export interface AiProviderConfig {
  aiProvider: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
}

export class AiProviderFactory {
  constructor(private readonly config: AiProviderConfig) {}

  create(): AiProvider {
    const apiKeys: Record<AiProviderName, string | undefined> = {
      openai: this.config.openaiApiKey,
      gemini: this.config.geminiApiKey,
      deepseek: this.config.deepseekApiKey,
      anthropic: this.config.anthropicApiKey,
      openrouter: this.config.openrouterApiKey,
    };
    const provider = aiProviderNames.find((name) => name === this.config.aiProvider);
    const apiKey = provider ? apiKeys[provider] : undefined;
    if (provider && apiKey) {
      return createAiProvider({ provider, apiKey });
    }
    throw new Error(
      `No AI provider configured for "${this.config.aiProvider}". Set OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY.`,
    );
  }
}

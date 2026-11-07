import {
  aiProviderNameSchema,
  embeddedAiModelCatalog,
  type AiProviderModels,
  type AiProviderName,
} from "@careerden/contracts";
import type { AiProvider } from "@careerden/domain";
import { ModelFallbackAiProvider } from "./model-fallback-ai.provider.js";
import { AnthropicAiProvider } from "./providers/anthropic-ai.provider.js";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";
import { OpenRouterAiProvider } from "./providers/openrouter-ai.provider.js";

export const aiProviderNames = aiProviderNameSchema.options;
export type { AiProviderName };

export interface AiProviderSelection {
  provider: AiProviderName;
  apiKey: string;
  // The user's own model choice. Omit to use the recommended model.
  model?: string;
  // The provider's recommended and fallback models from the remote catalog. Omit to use the
  // defaults embedded in this release.
  models?: AiProviderModels;
}

/**
 * The models to try, in order: the user's choice, then the catalog's recommended model, then its
 * fallbacks, without duplicates.
 */
export function aiModelCandidates(selection: AiProviderSelection): string[] {
  const models = selection.models ?? embeddedAiModelCatalog.providers[selection.provider];
  const candidates = [selection.model?.trim(), models.recommended, ...models.fallbacks].filter(
    (model): model is string => Boolean(model),
  );
  return [...new Set(candidates)];
}

export function createAiProvider(selection: AiProviderSelection): ModelFallbackAiProvider {
  return new ModelFallbackAiProvider(selection.provider, aiModelCandidates(selection), (model) =>
    createAiProviderForModel(selection.provider, selection.apiKey, model),
  );
}

export function createAiProviderForModel(
  provider: AiProviderName,
  apiKey: string,
  model: string,
): AiProvider {
  switch (provider) {
    case "openai":
      return new OpenAiAiProvider(apiKey, model);
    case "gemini":
      return new GeminiAiProvider(apiKey, model);
    case "deepseek":
      return new DeepSeekAiProvider(apiKey, model);
    case "anthropic":
      return new AnthropicAiProvider(apiKey, model);
    case "openrouter":
      return new OpenRouterAiProvider(apiKey, model);
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

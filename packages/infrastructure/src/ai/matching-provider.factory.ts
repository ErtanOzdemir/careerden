import type { AiMatchingProvider } from "@link2cv/domain";
import { DeepSeekMatchingProvider } from "./providers/deepseek-matching.provider.js";
import { GeminiMatchingProvider } from "./providers/gemini-matching.provider.js";
import { LocalHeuristicMatchingProvider } from "./providers/local-heuristic-matching.provider.js";
import { OpenAiMatchingProvider } from "./providers/openai-matching.provider.js";

export interface MatchingProviderConfig {
  aiProvider: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
}

export class MatchingProviderFactory {
  constructor(private readonly config: MatchingProviderConfig) {}

  create(): AiMatchingProvider {
    if (this.config.aiProvider === "deepseek" && this.config.deepseekApiKey) {
      return new DeepSeekMatchingProvider(this.config.deepseekApiKey);
    }
    if (this.config.aiProvider === "gemini" && this.config.geminiApiKey) {
      return new GeminiMatchingProvider(this.config.geminiApiKey);
    }
    if (this.config.aiProvider === "openai" && this.config.openaiApiKey) {
      return new OpenAiMatchingProvider(this.config.openaiApiKey);
    }
    return new LocalHeuristicMatchingProvider();
  }
}

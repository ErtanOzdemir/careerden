import type { AiProvider } from "@careerden/domain";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";

export interface AiProviderConfig {
  aiProvider: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
}

export class AiProviderFactory {
  constructor(private readonly config: AiProviderConfig) {}

  create(): AiProvider {
    if (this.config.aiProvider === "deepseek" && this.config.deepseekApiKey) {
      return new DeepSeekAiProvider(this.config.deepseekApiKey);
    }
    if (this.config.aiProvider === "gemini" && this.config.geminiApiKey) {
      return new GeminiAiProvider(this.config.geminiApiKey);
    }
    if (this.config.aiProvider === "openai" && this.config.openaiApiKey) {
      return new OpenAiAiProvider(this.config.openaiApiKey);
    }
    throw new Error(
      `No AI provider configured for "${this.config.aiProvider}". Set OPENAI_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY.`,
    );
  }
}

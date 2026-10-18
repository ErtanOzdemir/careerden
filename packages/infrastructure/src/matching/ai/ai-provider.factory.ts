import type { AiProvider } from "@careerden/domain";
import { DeepSeekAiProvider } from "./providers/deepseek-ai.provider.js";
import { GeminiAiProvider } from "./providers/gemini-ai.provider.js";
import { OpencodeAiProvider, type OpencodeAiProviderConfig } from "./providers/opencode-ai.provider.js";
import { OpenAiAiProvider } from "./providers/openai-ai.provider.js";
import { TieredAiProvider } from "./providers/tiered-ai.provider.js";

export interface AiProviderConfig {
  /** Paid provider used for subscribers. */
  aiProvider: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  /**
   * Provider for users without a paid subscription. `premium` reuses the paid provider, which keeps
   * local development working without the OpenCode container.
   */
  freeAiProvider: "opencode" | "premium";
  opencode?: Omit<OpencodeAiProviderConfig, "password"> & { password?: string };
}

export class AiProviderFactory {
  constructor(private readonly config: AiProviderConfig) {}

  create(): AiProvider {
    const premium = this.createPremium();
    return new TieredAiProvider({ free: this.createFree(premium), premium });
  }

  private createFree(premium: AiProvider): AiProvider {
    if (this.config.freeAiProvider === "premium") return premium;

    const opencode = this.config.opencode;
    if (!opencode?.password) {
      throw new Error(
        'No free AI provider configured for "opencode". Set OPENCODE_SERVER_PASSWORD or AI_FREE_PROVIDER=premium.',
      );
    }
    return new OpencodeAiProvider({ ...opencode, password: opencode.password });
  }

  private createPremium(): AiProvider {
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

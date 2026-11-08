import type { ZodType } from "zod";

export interface AiGenerateParams<T> {
  system: string;
  prompt: string;
  outputSchema: ZodType<T>;
  /**
   * `false` turns off model thinking where the provider supports it, trading depth for latency on
   * interactive requests the user is actively waiting on. Omit to keep the provider's default.
   */
  thinking?: boolean;
  /**
   * Called with the model that produced the output, which can differ from the configured one
   * after a fallback.
   */
  onModelUsed?: (model: AiModelUsage) => void;
}

/** Identifies the provider and model that produced an AI output. */
export interface AiModelUsage {
  provider: string;
  model: string;
}

export interface AiProvider {
  generate<T>(params: AiGenerateParams<T>): Promise<T>;
}

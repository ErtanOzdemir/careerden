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
}

export interface AiProvider {
  generate<T>(params: AiGenerateParams<T>): Promise<T>;
}

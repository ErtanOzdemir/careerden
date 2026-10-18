import type { ZodType } from "zod";

/**
 * `free` routes to the no-cost model pool used for users without a paid subscription; `premium`
 * routes to the paid provider reserved for subscribers.
 */
export type AiTier = "free" | "premium";

export interface AiGenerateParams<T> {
  tier: AiTier;
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

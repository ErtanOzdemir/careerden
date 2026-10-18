import type { AiGenerateParams, AiProvider, AiTier } from "@careerden/domain";

/**
 * Routes each request to the provider for its tier. There is deliberately no fallback between
 * tiers: a failing free provider must not silently spend paid-provider budget.
 */
export class TieredAiProvider implements AiProvider {
  constructor(private readonly providers: Record<AiTier, AiProvider>) {}

  generate<T>(params: AiGenerateParams<T>): Promise<T> {
    return this.providers[params.tier].generate(params);
  }
}

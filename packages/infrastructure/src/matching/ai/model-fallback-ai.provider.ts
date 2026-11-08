import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { isModelUnavailableError } from "./model-unavailable-error.js";

export interface ModelFallbackLogger {
  warn(message: string, details: Record<string, unknown>): void;
}

/**
 * Generates with the first candidate model and, when the provider reports that model as not found
 * or retired, retries once with the next candidate. Any other failure is returned unchanged, and
 * the model that produced the output is reported through `onModelUsed`.
 */
export class ModelFallbackAiProvider implements AiProvider {
  constructor(
    readonly provider: string,
    readonly models: readonly string[],
    private readonly createForModel: (model: string) => AiProvider,
    private readonly logger: ModelFallbackLogger = console,
  ) {
    if (models.length === 0) {
      throw new Error(`No AI model is configured for provider ${provider}`);
    }
  }

  /** The model tried first. */
  get model(): string {
    return this.models[0]!;
  }

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const [primary, fallback] = this.models;

    try {
      return await this.generateWith(primary!, params);
    } catch (error) {
      if (!fallback || !isModelUnavailableError(error)) throw error;

      this.logger.warn("AI model is unavailable; retrying with the fallback model", {
        provider: this.provider,
        model: primary,
        fallbackModel: fallback,
      });
      return this.generateWith(fallback, params);
    }
  }

  private async generateWith<T>(model: string, params: AiGenerateParams<T>): Promise<T> {
    const { onModelUsed, ...request } = params;
    const output = await this.createForModel(model).generate(request);
    onModelUsed?.({ provider: this.provider, model });
    return output;
  }
}

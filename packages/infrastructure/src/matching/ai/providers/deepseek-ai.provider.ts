import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

export class DeepSeekAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const deepseek = createDeepSeek({ apiKey: this.apiKey });

    return generateWithOutputSchema("deepseek", deepseek(this.model), params);
  }
}

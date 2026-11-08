import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createOpenAI } from "@ai-sdk/openai";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

export class OpenAiAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const openai = createOpenAI({ apiKey: this.apiKey });

    return generateWithOutputSchema("openai", openai(this.model), params);
  }
}

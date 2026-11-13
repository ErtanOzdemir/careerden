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

    // Strict structured outputs require every property to be required, and the lenient match
    // result schema has optional fields. @ai-sdk/openai 4 turned strict mode on by default.
    return generateWithOutputSchema("openai", openai(this.model), params, {
      openai: { strictJsonSchema: false },
    });
  }
}

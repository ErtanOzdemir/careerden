import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

export class AnthropicAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-haiku-5-5",
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const anthropic = createAnthropic({ apiKey: this.apiKey });

    return generateWithOutputSchema(anthropic(this.model), params);
  }
}

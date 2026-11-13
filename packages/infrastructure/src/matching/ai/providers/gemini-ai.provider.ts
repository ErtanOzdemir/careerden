import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createGoogle } from "@ai-sdk/google";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

export class GeminiAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const google = createGoogle({ apiKey: this.apiKey });

    // Gemini 2.5 Flash thinks by default, which dominates latency on interactive revisions.
    return generateWithOutputSchema(
      "gemini",
      google(this.model),
      params,
      params.thinking === false ? { google: { thinkingConfig: { thinkingBudget: 0 } } } : undefined,
    );
  }
}

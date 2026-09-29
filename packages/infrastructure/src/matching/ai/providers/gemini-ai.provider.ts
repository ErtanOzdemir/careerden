import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

export class GeminiAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.5-flash",
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const google = createGoogleGenerativeAI({ apiKey: this.apiKey });

    // Gemini 2.5 Flash thinks by default, which dominates latency on interactive revisions.
    return generateWithOutputSchema(
      google(this.model),
      params,
      params.thinking === false ? { google: { thinkingConfig: { thinkingBudget: 0 } } } : undefined,
    );
  }
}

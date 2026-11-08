import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateWithOutputSchema } from "../generate-with-output-schema.js";

// OpenRouter fronts many vendors' models, including free ones, behind one OpenAI-compatible API.
// Model ids are user-supplied, for example "thinkingmachines/inkling-small:free".
export class OpenRouterAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.apiKey,
      headers: { "X-Title": "Careerden" },
      supportsStructuredOutputs: true,
    });

    return generateWithOutputSchema("openrouter", openrouter.chatModel(this.model), params);
  }
}

import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";

export class GeminiAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.5-flash",
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const google = createGoogleGenerativeAI({ apiKey: this.apiKey });
    const { output } = await generateText({
      model: google(this.model),
      output: Output.object({ schema: params.outputSchema }),
      system: params.system,
      prompt: params.prompt,
    });
    return params.outputSchema.parse(output);
  }
}

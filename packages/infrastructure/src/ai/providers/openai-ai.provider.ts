import type { AiGenerateParams, AiProvider } from "@link2cv/domain";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

export class OpenAiAiProvider implements AiProvider {
  constructor(private readonly apiKey: string, private readonly model = "gpt-4.1-mini") {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const openai = createOpenAI({ apiKey: this.apiKey });
    const { output } = await generateText({
      model: openai(this.model),
      output: Output.object({ schema: params.outputSchema }),
      system: params.system,
      prompt: params.prompt,
    });
    return params.outputSchema.parse(output);
  }
}

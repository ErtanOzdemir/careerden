import type { AiGenerateParams, AiProvider } from "@link2cv/domain";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";

export class DeepSeekAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "deepseek-chat",
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const deepseek = createDeepSeek({ apiKey: this.apiKey });
    const { output } = await generateText({
      model: deepseek(this.model),
      output: Output.object({ schema: params.outputSchema }),
      system: params.system,
      prompt: params.prompt,
    });
    return params.outputSchema.parse(output);
  }
}

import type { AiMatchingProvider, MatchAnalysisInput, MatchAnalysisResult } from "@link2cv/domain";
import { createOpenAI } from "@ai-sdk/openai";
import { runAiSdkMatchAnalysis } from "./ai-sdk-match-analysis.js";

export class OpenAiMatchingProvider implements AiMatchingProvider {
  constructor(private readonly apiKey: string, private readonly model = "gpt-4.1-mini") {}

  async analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult> {
    const openai = createOpenAI({
      apiKey: this.apiKey
    });

    return runAiSdkMatchAnalysis(openai(this.model), input);
  }
}

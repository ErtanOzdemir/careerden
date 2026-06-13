import type { AiMatchingProvider, MatchAnalysisInput, MatchAnalysisResult } from "@link2cv/domain";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { runAiSdkMatchAnalysis } from "./ai-sdk-match-analysis.js";

export class DeepSeekMatchingProvider implements AiMatchingProvider {
  constructor(private readonly apiKey: string, private readonly model = "deepseek-chat") {}

  async analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult> {
    const deepseek = createDeepSeek({
      apiKey: this.apiKey
    });

    return runAiSdkMatchAnalysis(deepseek(this.model), input);
  }
}

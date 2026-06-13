import type { AiMatchingProvider, MatchAnalysisInput, MatchAnalysisResult } from "@link2cv/domain";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { runAiSdkMatchAnalysis } from "./ai-sdk-match-analysis.js";

export class GeminiMatchingProvider implements AiMatchingProvider {
  constructor(private readonly apiKey: string, private readonly model = "gemini-2.5-flash") {}

  async analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult> {
    const google = createGoogleGenerativeAI({
      apiKey: this.apiKey
    });

    return runAiSdkMatchAnalysis(google(this.model), input);
  }
}

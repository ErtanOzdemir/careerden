import type { MatchAnalysisInput, MatchAnalysisResult } from "../entities/match-analysis.js";

export interface AiMatchingProvider {
  analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult>;
}

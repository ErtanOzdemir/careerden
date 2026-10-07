import type {
  DocumentContent,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@careerden/domain";

export type DocumentType = "cv" | "cover_letter" | "both";

export type DocumentTone = "professional" | "concise" | "creative";

export interface DocumentPreferences {
  templateId: string;
  documentType: DocumentType;
  language: string;
  tone: DocumentTone;
}

export interface PremiumAiResult {
  matchAnalysis: MatchAnalysisResult;
  documentContent: DocumentContent;
  keywords: string[];
  creditsRemaining: number;
}

export interface PremiumAiInput {
  scrape: ScrapeBundle;
  profile: UserProfile;
  preferences: DocumentPreferences;
}

export interface PremiumAiService {
  generate(input: PremiumAiInput): Promise<PremiumAiResult>;
}

export class InsufficientCreditsError extends Error {
  readonly checkoutUrl: string;
  constructor(checkoutUrl: string) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
    this.checkoutUrl = checkoutUrl;
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export class AiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGenerationError";
  }
}

import type { ScrapeBundle } from "./scraped-data.js";
import type { UserProfile } from "./user-profile.js";

export interface MatchAnalysisInput {
  profile: UserProfile;
  scrape: ScrapeBundle;
}

export interface MatchAnalysisResult {
  matchScore: number;
  missingSkills: string[];
  strongSkills: string[];
  recommendedAchievements: string[];
  customizedSummary: string;
  interviewTips: string[];
  coverLetterGuidance?: string[];
}

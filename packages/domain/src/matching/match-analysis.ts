import type { UserProfile } from "../profiles/user-profile.js";
import type { ScrapeBundle } from "../scraping/scraped-data.js";

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
  experienceEnhancements?: ExperienceEnhancement[];
  skillSuggestions?: string[];
  educationEnhancements?: EducationEnhancement[];
  projectEnhancements?: ProjectEnhancement[];
  certificationSuggestions?: string[];
}

export interface ExperienceEnhancement {
  experienceIndex: number;
  enhancedDescription?: string;
  enhancedAchievements?: string[];
}

export interface EducationEnhancement {
  educationIndex: number;
  enhancedDescription?: string;
  enhancedAchievements?: string[];
}

export interface ProjectEnhancement {
  projectIndex: number;
  enhancedDescription?: string;
  enhancedAchievements?: string[];
}

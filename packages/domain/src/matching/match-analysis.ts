import type { UserProfile } from "../profiles/user-profile.js";
import type { ScrapeBundle } from "../scraping/scraped-data.js";

export interface MatchAnalysisInput {
  profile: UserProfile;
  scrape: ScrapeBundle;
}

export interface MatchAnalysisResult {
  coverLetterContent?: string;
  matchScore: number;
  requirementEvaluations?: RequirementEvaluation[];
  missingSkills: string[];
  missingSkillResources?: MissingSkillResource[];
  strongSkills: string[];
  summaryTips: string[];
  interviewTips: string[];
  coverLetterGuidance?: string[];
  experienceTips?: ExperienceTips[];
  skillsTips?: string[];
  educationTips?: EducationTips[];
  projectTips?: ProjectTips[];
  certificationsTips?: string[];
}

export interface MissingSkillResource {
  skill: string;
  title: string;
  url: string;
  type: "documentation" | "tutorial" | "article" | "video" | "other";
  reason: string;
}

export interface RequirementEvaluation {
  requirement: string;
  status: "matched" | "partial" | "missing";
  evidence: string[];
}

export interface ExperienceTips {
  experienceIndex: number;
  tips: string[];
}

export interface EducationTips {
  educationIndex: number;
  tips: string[];
}

export interface ProjectTips {
  projectIndex: number;
  tips: string[];
}

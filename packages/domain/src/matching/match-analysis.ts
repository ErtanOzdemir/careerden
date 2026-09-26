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
  summaryTips: CvTip[];
  interviewTips: string[];
  coverLetterGuidance?: string[];
  experienceTips?: ExperienceTips[];
  skillsTips?: CvListTip[];
  educationTips?: EducationTips[];
  projectTips?: ProjectTips[];
  certificationsTips?: CvListTip[];
  gapQuestions?: GapQuestion[];
}

/** The CV field a gap question's answer belongs in. */
export type GapQuestionField =
  | { type: "summary" }
  | { type: "experience" | "education" | "project"; index: number };

/**
 * A question for the candidate about experience the job asks for but the profile does not show
 * (or shows without measurable outcomes). The answer is the candidate's own statement, so it can
 * ground a CV revision without the AI inventing anything.
 */
export interface GapQuestion {
  question: string;
  requirement?: string;
  field: GapQuestionField;
}

/**
 * One suggestion for improving a prose CV field. `requirement` is the job requirement it addresses
 * (verbatim from the scraped requirements) and `evidence` is a phrase copied from the profile that
 * the tip relies on; both are dropped during normalization unless they are verified, so the
 * apply-tip revision can use them as trusted grounding.
 */
export interface CvTip {
  text: string;
  requirement?: string;
  evidence?: string;
}

/** Suggests one concrete item (a skill or certification) the candidate may add if it is true. */
export interface CvListTip {
  item: string;
  text: string;
  requirement?: string;
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
  /** Absent on analyses stored before priorities existed; treated as "must". */
  priority?: RequirementPriority;
}

export type RequirementPriority = "must" | "nice";

export interface ExperienceTips {
  experienceIndex: number;
  tips: CvTip[];
}

export interface EducationTips {
  educationIndex: number;
  tips: CvTip[];
}

export interface ProjectTips {
  projectIndex: number;
  tips: CvTip[];
}

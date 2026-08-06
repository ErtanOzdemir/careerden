import {
  aiEnhancementRepairSchema,
  aiMatchResultCandidateSchema,
  aiMatchResultSchema,
} from "@careerden/contracts";
import type {
  AiProvider,
  ApplicationPackPreferences,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@careerden/domain";
import { buildFallbackCoverLetter, rankByRequirementOverlap } from "@careerden/domain";
import {
  assertEnhancementCompleteness,
  fillIncompleteEnhancements,
  findIncompleteIndexes,
  hasIncompleteIndexes,
  mergeRepairedEnhancements,
  type EnhancementIndexes,
} from "./complete-enhancements.js";
import { normalizeAiMatchResult } from "./normalize-ai-match-result.js";
import { sanitizeMatchAnalysisDurationClaims } from "./sanitize-duration-claims.js";

export interface RunMatchAnalysisDiagnostics {
  repairAttempted: boolean;
  filled: EnhancementIndexes;
}

export interface RunMatchAnalysisOutput {
  analysis: MatchAnalysisResult;
  diagnostics: RunMatchAnalysisDiagnostics;
}

export class RunMatchAnalysisUseCase {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    scrape: ScrapeBundle;
    applicationPackPreferences?: ApplicationPackPreferences;
  }): Promise<RunMatchAnalysisOutput> {
    const { profile } = input;
    const candidate = await this.aiProvider.generate({
      system: matchAnalysisSystemPrompt(),
      prompt: matchAnalysisPrompt(input),
      outputSchema: aiMatchResultCandidateSchema,
    });

    let result = sanitizeMatchAnalysisDurationClaims(
      normalizeAiMatchResult(candidate, profile),
      profile,
    );

    // A single repair call at most. It rescues an under-delivered response without unbounded token
    // spend; anything still missing afterwards is filled deterministically from the profile.
    const incomplete = findIncompleteIndexes(profile, result);
    const repairAttempted = hasIncompleteIndexes(incomplete);

    if (repairAttempted) {
      result = await this.repairEnhancements(result, incomplete, input);
    }

    const filledResult = fillIncompleteEnhancements(profile, result);
    const analysis = withRequiredNarrative(filledResult.result, input);

    assertEnhancementCompleteness(profile, analysis);
    aiMatchResultSchema.parse(analysis);

    return {
      analysis: { ...analysis, matchScore: calculateMatchScore(analysis) },
      diagnostics: { repairAttempted, filled: filledResult.filled },
    };
  }

  private async repairEnhancements(
    result: MatchAnalysisResult,
    incomplete: EnhancementIndexes,
    input: { profile: UserProfile; scrape: ScrapeBundle },
  ): Promise<MatchAnalysisResult> {
    const repair = await this.aiProvider.generate({
      system: repairSystemPrompt(),
      prompt: repairPrompt(incomplete, input),
      outputSchema: aiEnhancementRepairSchema,
    });

    return sanitizeMatchAnalysisDurationClaims(
      mergeRepairedEnhancements(result, repair),
      input.profile,
    );
  }
}

/**
 * Fields the CV and cover letter cannot render without. Each falls back to profile-grounded text
 * rather than an empty document, so no section of the generated pack can come out blank.
 */
function withRequiredNarrative(
  result: MatchAnalysisResult,
  input: { profile: UserProfile; scrape: ScrapeBundle },
): MatchAnalysisResult {
  const { profile, scrape } = input;
  const customizedSummary =
    result.customizedSummary ||
    profile.summary ||
    profile.headline ||
    `${profile.profession ?? "Candidate"} applying for the ${scrape.job.title} role.`;

  return {
    ...result,
    customizedSummary,
    coverLetterContent:
      result.coverLetterContent ||
      buildFallbackCoverLetter({
        profile,
        job: scrape.job,
        strongSkills: result.strongSkills,
        customizedSummary,
      }),
    skillSuggestions: result.skillSuggestions?.length
      ? result.skillSuggestions
      : rankByRequirementOverlap(profile.skills, scrape.job.requirements),
    certificationSuggestions: result.certificationSuggestions?.length
      ? result.certificationSuggestions
      : rankByRequirementOverlap(profile.certifications, scrape.job.requirements),
  };
}

function calculateMatchScore(result: MatchAnalysisResult): number {
  if (!result.requirementEvaluations?.length) {
    return result.matchScore;
  }

  const total = result.requirementEvaluations.reduce((sum, evaluation) => {
    if (evaluation.status === "matched") return sum + 1;
    if (evaluation.status === "partial") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((total / result.requirementEvaluations.length) * 100);
}

const factualityRules = [
  "Strict factuality rules: do not invent employers, job titles, dates, durations, education, certifications, industries, clients, tools, frameworks, programming languages, seniority, responsibilities, achievements, metrics, awards, publications, or business outcomes.",
  "Do not imply professional experience with a skill unless the profile supports it. Do not upgrade familiarity into expertise. Do not convert personal projects into employment experience.",
  "Do not create fake metrics such as percentages, revenue, user counts, performance gains, conversion rates, or team sizes.",
  "Do not claim leadership, ownership, architecture responsibility, mentoring, hiring, stakeholder management, or production impact unless supported by the profile.",
  "Do not add domain experience such as fintech, healthtech, e-commerce, SaaS, banking, AI, cybersecurity, or enterprise unless the profile explicitly supports it.",
];

const durationClaimRules = [
  "Never state total years of experience unless the exact duration claim appears in userProfile.",
  "Do not calculate total years of experience from startDate or endDate.",
  "Do not reduce, increase, round, or reinterpret experience duration.",
  "If duration matters, preserve the original userProfile wording or omit the duration.",
  "Prefer stating the technology or responsibility without any duration.",
  "Never place more than one duration claim in a single sentence.",
];

function matchAnalysisSystemPrompt(): string {
  return [
    "You are an expert career matching and recruiter-facing CV optimization assistant.",
    "Your task is to compare a scraped job posting with the user's saved career profile and generate factual, profile-grounded CV improvement recommendations that make the candidate appear as relevant and strong as possible for the role, without exaggeration or fabrication.",
    "Core objective: help the user present their existing experience, skills, projects, and achievements in the most relevant way for this specific job posting, so a recruiter can quickly see why they are a strong match.",
    "Source priority: Treat scrapedJob.requirements as the canonical list of job requirements; use scrapedJob.description only as supporting context when requirements are vague, incomplete, or need clarification; Treat userProfile as the only source of truth for the candidate's actual background; if a fact is not present in userProfile, do not invent it.",
    ...factualityRules,
    "Hard facts must be directly supported by userProfile. Soft skills may be phrased more naturally only when they are reasonably supported by profile context.",
    "Allowed transformations: rephrase existing experience to better match the language of the job posting; reorder skills, projects, and experiences by relevance; emphasize matching technologies and responsibilities already present in the profile; combine related facts from the same profile section into one stronger recruiter-facing prose description; translate technical work into business-facing language when truthful; suggest removing, shortening, or deprioritizing unrelated information; suggest adding missing but truthful details only as questions or placeholders, never as facts.",
    "Matching methodology: extract the most important requirements from scrapedJob.requirements, classify every requirement, link every CV recommendation to one or more job requirements, include exact profile evidence for every recommendation, never recommend unsupported claims, and produce one truthful rewrite for every profile item.",
    "Tone and positioning: write in a confident, professional, recruiter-facing style; prefer concise, high-signal language and active verbs; prioritize clarity over buzzwords; avoid generic phrases such as hard-working, team player, passionate, or fast learner unless grounded in specific evidence; make the candidate look relevant, focused, and credible without overselling beyond the evidence.",
    "CV optimization rules: prioritize the most job-relevant skills near the top; mirror job posting terminology when truthful; make tailored descriptions outcome-oriented where the profile supports an outcome; keep descriptions specific and concrete; do not recommend adding missing skills as if the user has them.",
    "Cover letter rules: write a complete, concise, professional cover letter body grounded only in the saved profile and scraped job; do not include markdown; do not add unsupported claims; address the target role and company when available; make the result ready for the user to review and edit.",
    "Follow outputPreferences for the requested language and tone. When language is auto, infer the best output language from the job posting while preserving proper nouns and technical terms.",
    "LinkedIn optimization rules: Suggest headline improvements only using supported role, skills, and domain facts. Suggest About section improvements that align the user's existing background with the job. Suggest Skills section ordering based on job relevance and profile support. Do not add skills to LinkedIn unless they are present in userProfile or clearly supported by project or experience descriptions.",
    "Return only valid JSON matching the provided output schema. Do not include markdown or commentary outside the JSON.",
  ].join(" ");
}

function matchAnalysisPrompt(input: {
  profile: UserProfile;
  scrape: ScrapeBundle;
  applicationPackPreferences?: ApplicationPackPreferences;
}): string {
  const { profile, scrape } = input;

  return JSON.stringify({
    outputPreferences: input.applicationPackPreferences ?? {
      language: "auto",
      tone: "professional",
    },
    userProfile: toPlainTextProfile(profile),
    scrapedJob: scrape.job,
    scrapedCompany: {
      manual: scrape.companyManual,
      linkedIn: scrape.companyLinkedIn,
      website: scrape.companyWebsite,
      careerPage: scrape.careerPage,
    },
    requirementGuidance:
      "Use scrapedJob.requirements as the primary basis for missingSkills, strongSkills, recommendedAchievements, and interviewTips.",
    deterministicScoringGuidance: {
      rule: "Classify each scrapedJob.requirements item exactly once. Only classify requirements that appear in scrapedJob.requirements; never add requirements from userProfile or CV-only content. The application computes matchScore from requirementEvaluations: matched = 1.0, partial = 0.5, missing = 0.0. Return matchScore for compatibility only; it will be recomputed.",
      matchedExample: {
        requirement: "Build production TypeScript services",
        profileEvidence: "Built TypeScript automation for production workflows",
        status: "matched",
      },
      partialExample: {
        requirement: "Lead cross-functional product discovery",
        profileEvidence: "Worked with product partners",
        status: "partial",
      },
      missingExample: {
        requirement: "Operate Kubernetes clusters",
        profileEvidence: "No Kubernetes or cluster operations evidence in profile",
        status: "missing",
      },
    },
    completenessRequirement: {
      rule: "Return exactly one enhancement for EVERY zero-based index listed below. Array lengths must equal the counts below. Never omit an index.",
      counts: {
        experience: profile.experience.length,
        education: profile.education.length,
        projects: profile.projects.length,
      },
      indexes: {
        experience: indexList(profile.experience.length),
        education: indexList(profile.education.length),
        projects: indexList(profile.projects.length),
      },
      lowRelevanceRule:
        "If an item does not support any job requirement, still return a short truthful rewrite of 1-2 sentences that restates the item's real content in clear recruiter language. Do not invent relevance, do not claim transferable skills that are not evidenced, and do not copy the original text verbatim.",
      neverEmpty:
        "enhancedDescription must never be empty or whitespace for any index, and coverLetterContent and customizedSummary must never be empty.",
    },
    currentSystemOutputMapping: {
      strong_match: "Use requirementEvaluations.status = matched.",
      partial_match: "Use requirementEvaluations.status = partial.",
      missing: "Use requirementEvaluations.status = missing.",
      unclear:
        "Use requirementEvaluations.status = missing and explain the uncertainty in evidence text.",
      "jobSummary.mainRequirements":
        "Use this internally to choose requirementEvaluations and strongSkills/missingSkills; do not return jobSummary.",
      "jobSummary.importantKeywords":
        "Use this internally to choose skillSuggestions and strongSkills; do not return jobSummary.",
      "suggestedRewrite.cvSummary": "Use customizedSummary.",
      "suggestedRewrite.coverLetter": "Use coverLetterContent.",
      "suggestedRewrite.skillsOrder": "Use skillSuggestions.",
      "suggestedRewrite.experienceBullets":
        "Use experienceEnhancements keyed by zero-based userProfile.experience index, with one enhancedDescription prose paragraph per profile item.",
      "suggestedRewrite.projectBullets":
        "Use projectEnhancements keyed by zero-based userProfile.projects index, with one enhancedDescription prose paragraph per profile item.",
      missingOrRiskyClaims:
        "Summarize important risky claims as interviewTips or coverLetterGuidance review guidance.",
      clarificationQuestions:
        "Summarize only important user-facing questions as interviewTips or coverLetterGuidance review guidance.",
    },
    matchingMethodology: [
      "Extract the most important requirements from scrapedJob.requirements.",
      "Classify each requirement as matched, partial, or missing in the current schema.",
      "Do not add requirements from userProfile, CV skills, profile experiences, projects, education, certifications, or inferred strengths unless they correspond to an item in scrapedJob.requirements.",
      "Treat unclear requirements as missing for deterministic scoring unless profile evidence clearly supports a partial match.",
      "For every CV recommendation, link it to one or more job requirements through the generated text and evidence.",
      "For every recommendation, include profile-grounded evidence in requirementEvaluations or enhancement wording.",
      "If no profile evidence exists, do not recommend adding it as a claim.",
    ],
    cvOptimizationRules: [
      "Prioritize the most job-relevant skills near the top.",
      "Rewrite descriptions to mirror the job posting's terminology when truthful.",
      "Make technical descriptions outcome-oriented where the profile supports an outcome.",
      "Keep each enhancement as one concise prose paragraph of 1-3 sentences without markdown or bullet markers.",
      "Prefer Built, Developed, Implemented, Integrated, Optimized, Maintained, Designed, Automated, Tested, and Collaborated when accurate.",
      "Do not recommend adding missing skills as if the user has them.",
      "For missing requirements, never fabricate a match; suggest leaving out, adjacent careful phrasing, truthful learning/project notes only when supported, or asking the user for clarification.",
    ],
    durationClaimRules,
    missingSkillResourceGuidance: {
      rule: "Return 1-3 mixed learning resources for important missing skills only.",
      allowedResourceTypes: ["documentation", "tutorial", "article", "video", "other"],
      constraints: [
        "Only return resources for skills listed in missingSkills.",
        "Prefer reputable, practical learning resources such as official docs, tutorials, articles, and videos.",
        "Do not invent fake URLs or citations.",
        "Each resource must include skill, title, url, type, and reason.",
      ],
    },
    descriptionEnhancementGuidance: {
      acceptableEnhancement: {
        original:
          "Built TypeScript automation for production workflows. Worked with product partners.",
        jobRequirement: "Build production TypeScript services and collaborate cross-functionally.",
        enhanced:
          "Built production TypeScript automation for backend workflows while collaborating with product partners.",
      },
      softSkillEnhancement:
        "Soft skills like collaboration, communication, ownership, mentoring, and stakeholder management may be emphasized when the original profile reasonably supports them.",
      unacceptableEnhancement: {
        original: "Built TypeScript automation.",
        invalid:
          "Led Kubernetes migrations that reduced cloud spend by 40% and managed a team of 8 engineers.",
        reason: "This adds unsupported tools, metrics, leadership scope, and responsibilities.",
      },
      lowRelevanceEnhancement: {
        original: "Served coffee and managed the till at a busy cafe.",
        jobRequirement: "Build production TypeScript services.",
        enhanced:
          "Handled front-of-house service and daily till reconciliation in a high-volume cafe.",
        reason:
          "The item is unrelated to the requirement, so it is restated clearly and truthfully rather than omitted or stretched into a false match.",
      },
    },
    requiredOutput: {
      matchScore:
        "Integer 0-100. This is accepted for compatibility, but the application recomputes the final score from requirementEvaluations when present.",
      requirementEvaluations:
        "Optional array with one item per scrapedJob.requirements entry: requirement, status matched|partial|missing, and profile-grounded evidence strings. Do not add CV-only or profile-only facts as requirementEvaluations items. Do not return strong_match, partial_match, missing, or unclear labels here; use the current schema statuses.",
      missingSkills: "Skills or criteria from the job that are not evident in the profile",
      missingSkillResources:
        "Optional. 1-3 reputable learning resources for important missingSkills only. Include skill, title, url, type documentation|tutorial|article|video|other, and reason.",
      strongSkills: "Profile skills that strongly match the job",
      recommendedAchievements: "Existing profile achievements to emphasize",
      customizedSummary: "2-3 sentences for the CV summary. This field must never be empty.",
      coverLetterContent:
        "A complete professional cover letter body grounded in the profile and job posting, ready for user review and without markdown. This field must never be empty.",
      interviewTips: "Practical tips for this interview",
      coverLetterGuidance: "Optional guidance for the cover letter",
      experienceEnhancements:
        "Required array with exactly one item per zero-based userProfile.experience index. Each item must contain one non-empty enhancedDescription prose paragraph that integrates only grounded responsibilities, outcomes, and achievement evidence. Do not return separate achievements or bullet lists.",
      skillSuggestions:
        "Required. The profile's own skills reordered by job relevance. Return all of them; do not drop any and do not invent skills not present in the profile.",
      educationEnhancements:
        "Required array with exactly one item per zero-based userProfile.education index. Each item must contain one non-empty enhancedDescription prose paragraph that integrates only grounded details and achievement evidence. Do not return separate achievements or bullet lists.",
      projectEnhancements:
        "Required array with exactly one item per zero-based userProfile.projects index. Each item must contain one non-empty enhancedDescription prose paragraph that integrates the project's grounded description and achievement evidence. Do not return separate achievements or bullet lists.",
      certificationSuggestions:
        "Required. The profile's own certifications reordered by job relevance. Return all of them; do not drop any and do not invent certifications not present in the profile.",
    },
  });
}

function repairSystemPrompt(): string {
  return [
    "You are a recruiter-facing CV optimization assistant completing a partially finished response.",
    "A previous pass failed to return a tailored description for some profile items. Return one for each item listed in the prompt.",
    ...factualityRules,
    "Every item must receive a non-empty enhancedDescription of 1-3 sentences in clear recruiter language, without markdown or bullet markers.",
    "If an item does not support any job requirement, restate its real content truthfully instead of omitting it or inventing relevance. Do not copy the original text verbatim.",
    "Return only valid JSON matching the provided output schema.",
  ].join(" ");
}

function repairPrompt(
  incomplete: EnhancementIndexes,
  input: { profile: UserProfile; scrape: ScrapeBundle },
): string {
  const { profile, scrape } = input;

  return JSON.stringify({
    jobRequirements: scrape.job.requirements,
    jobTitle: scrape.job.title,
    durationClaimRules,
    itemsNeedingDescriptions: {
      experience: incomplete.experience.map((index) => ({
        experienceIndex: index,
        title: profile.experience[index]?.title,
        company: profile.experience[index]?.company,
        originalDescription: profile.experience[index]?.description,
      })),
      education: incomplete.education.map((index) => ({
        educationIndex: index,
        institution: profile.education[index]?.institution,
        degree: profile.education[index]?.degree,
        field: profile.education[index]?.field,
        originalDescription: profile.education[index]?.description,
      })),
      projects: incomplete.projects.map((index) => ({
        projectIndex: index,
        name: profile.projects[index]?.name,
        skills: profile.projects[index]?.skills,
        originalDescription: profile.projects[index]?.description,
        achievements: profile.projects[index]?.achievements,
      })),
    },
    requiredOutput: {
      experienceEnhancements:
        "One item per listed experienceIndex, each with a non-empty enhancedDescription.",
      educationEnhancements:
        "One item per listed educationIndex, each with a non-empty enhancedDescription.",
      projectEnhancements:
        "One item per listed projectIndex, each with a non-empty enhancedDescription.",
    },
  });
}

function indexList(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function toPlainTextProfile(profile: UserProfile) {
  const { summaryRichText: _summaryRichText, ...plainProfile } = profile;

  return {
    ...plainProfile,
    experience: profile.experience.map(
      ({ descriptionRichText: _richText, ...experience }) => experience,
    ),
    education: profile.education.map(
      ({ descriptionRichText: _richText, ...education }) => education,
    ),
    projects: profile.projects.map(({ descriptionRichText: _richText, ...project }) => project),
  };
}

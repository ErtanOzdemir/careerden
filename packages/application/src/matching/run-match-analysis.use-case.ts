import { aiMatchResultCandidateSchema, aiMatchResultSchema } from "@careerden/contracts";
import type {
  AiProvider,
  AiTier,
  ApplicationPackPreferences,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@careerden/domain";
import { buildFallbackCoverLetter } from "@careerden/domain";
import { fillMissingTipEntries } from "./complete-enhancements.js";
import { normalizeAiMatchResult } from "./normalize-ai-match-result.js";
import { sanitizeMatchAnalysisDurationClaims } from "./sanitize-duration-claims.js";

export class RunMatchAnalysisUseCase {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    scrape: ScrapeBundle;
    applicationPackPreferences?: ApplicationPackPreferences;
    aiTier: AiTier;
  }): Promise<MatchAnalysisResult> {
    const { profile } = input;
    const candidate = await this.aiProvider.generate({
      tier: input.aiTier,
      system: matchAnalysisSystemPrompt(),
      prompt: matchAnalysisPrompt(input),
      outputSchema: aiMatchResultCandidateSchema,
    });

    const result = sanitizeMatchAnalysisDurationClaims(
      normalizeAiMatchResult(candidate, profile, input.scrape.job.requirements),
      profile,
    );
    const filled = fillMissingTipEntries(profile, result);
    const analysis = withRequiredNarrative(filled, input);

    aiMatchResultSchema.parse(analysis);

    return { ...analysis, matchScore: calculateMatchScore(analysis) };
  }
}

/**
 * The one field the CV/cover letter still cannot render without: a full cover letter body. Falls
 * back to profile-grounded text rather than an empty document. Every other field is now a tip list,
 * and an empty tip list is a legitimate "nothing to suggest" — not a gap that needs papering over.
 */
function withRequiredNarrative(
  result: MatchAnalysisResult,
  input: { profile: UserProfile; scrape: ScrapeBundle },
): MatchAnalysisResult {
  const { profile, scrape } = input;
  const summary = profile.summary || profile.headline || "";

  return {
    ...result,
    coverLetterContent:
      result.coverLetterContent ||
      buildFallbackCoverLetter({
        profile,
        job: scrape.job,
        strongSkills: result.strongSkills,
        summary,
      }),
  };
}

/** Must-have requirements count twice as much as nice-to-haves; unprioritized ones count as must. */
const PRIORITY_WEIGHT = { must: 2, nice: 1 } as const;

function calculateMatchScore(result: MatchAnalysisResult): number {
  if (!result.requirementEvaluations?.length) {
    return result.matchScore;
  }

  let earned = 0;
  let possible = 0;
  for (const evaluation of result.requirementEvaluations) {
    const weight = PRIORITY_WEIGHT[evaluation.priority ?? "must"];
    possible += weight;
    if (evaluation.status === "matched") earned += weight;
    if (evaluation.status === "partial") earned += weight / 2;
  }

  return Math.round((earned / possible) * 100);
}

// Shared with the single-field apply-tip prompt (see apply-document-field-tip.use-case.ts) — both
// AI calls revise CV-facing text and must follow the same non-fabrication rules.
export const factualityRules = [
  "Strict factuality rules: do not invent employers, job titles, dates, durations, education, certifications, industries, clients, tools, frameworks, programming languages, seniority, responsibilities, achievements, metrics, awards, publications, or business outcomes.",
  "Do not imply professional experience with a skill unless the profile supports it. Do not upgrade familiarity into expertise. Do not convert personal projects into employment experience.",
  "Do not create fake metrics such as percentages, revenue, user counts, performance gains, conversion rates, or team sizes.",
  "Do not claim leadership, ownership, architecture responsibility, mentoring, hiring, stakeholder management, or production impact unless supported by the profile.",
  "Do not add domain experience such as fintech, healthtech, e-commerce, SaaS, banking, AI, cybersecurity, or enterprise unless the profile explicitly supports it.",
];

export const durationClaimRules = [
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
    "Your task is to compare a scraped job posting with the user's saved career profile and generate factual, profile-grounded CV improvement suggestions that make the candidate appear as relevant and strong as possible for the role, without exaggeration or fabrication.",
    "Core objective: help the user see, field by field, how to present their existing experience, skills, projects, and achievements more relevantly for this specific job posting — as short actionable tips the user chooses whether to apply, not as a rewrite forced on them.",
    "Source priority: Treat scrapedJob.requirements as the canonical list of job requirements; use scrapedJob.description only as supporting context when requirements are vague, incomplete, or need clarification; Treat userProfile as the only source of truth for the candidate's actual background; if a fact is not present in userProfile, do not invent it.",
    ...factualityRules,
    "Hard facts must be directly supported by userProfile. Soft skills may be phrased more naturally only when they are reasonably supported by profile context.",
    "Every tip must name a concrete, actionable change: mention a specific fact already in the profile, reorder/lead with a specific item, or name a specific skill to add. Never write a vague tip like 'improve this section' or 'make it more relevant.'",
    "Matching methodology: extract the most important requirements from scrapedJob.requirements, classify every requirement, link every tip to one or more job requirements it addresses, and ground every tip in real profile evidence.",
    "Tone: write tips as short, direct notes to the candidate (imperative or suggestive phrasing), e.g. 'Mention the production incident you resolved' or 'Lead with the migration project, it's more relevant here.'",
    "It is normal and expected for a strong, already-relevant profile item to need no tips at all — return an empty array rather than inventing a tip that has nothing real to add.",
    "Cover letter rules: write a complete, concise, professional cover letter body grounded only in the saved profile and scraped job; do not include markdown; do not add unsupported claims; address the target role and company when available; make the result ready for the user to review and edit.",
    "Follow outputPreferences for the requested language and tone. When language is auto, infer the best output language from the job posting while preserving proper nouns and technical terms.",
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
      "Use scrapedJob.requirements as the primary basis for missingSkills, strongSkills, and every tip list.",
    deterministicScoringGuidance: {
      rule: "Classify each scrapedJob.requirements item exactly once. Only classify requirements that appear in scrapedJob.requirements; never add requirements from userProfile or CV-only content. The application computes matchScore from requirementEvaluations: matched = 1.0, partial = 0.5, missing = 0.0, with must-have requirements weighted twice as heavily as nice-to-haves. Return matchScore for compatibility only; it will be recomputed.",
      priorityRule:
        "Set priority to 'nice' only when scrapedJob.description marks the requirement as preferred, a plus, a bonus, nice to have, or desirable; otherwise use 'must'.",
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
      rule: "Return exactly one tips entry for EVERY zero-based index listed below, even if its tips array is empty. Array lengths must equal the counts below. Never omit an index.",
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
    },
    matchingMethodology: [
      "Extract the most important requirements from scrapedJob.requirements.",
      "Classify each requirement as matched, partial, or missing in the current schema.",
      "Do not add requirements from userProfile, CV skills, profile experiences, projects, education, certifications, or inferred strengths unless they correspond to an item in scrapedJob.requirements.",
      "Treat unclear requirements as missing for deterministic scoring unless profile evidence clearly supports a partial match.",
      "For every tip, link it to one or more job requirements through its wording.",
      "If no profile evidence exists for a possible tip, do not suggest it.",
    ],
    tipShape: {
      proseTip:
        "summaryTips and every experience/education/project tips entry is an object { text, requirement, evidence }.",
      text: "One short sentence describing a specific, concrete change — not a rewrite of the field.",
      requirement:
        "The single scrapedJob.requirements item this tip addresses, copied exactly character for character. Use an empty string if the tip does not address one specific requirement.",
      evidence:
        "A short phrase (roughly 4-20 words) copied verbatim from userProfile that the tip relies on, so the change can be made truthfully. Copy it exactly; do not paraphrase, translate, or combine phrases. Use an empty string if the tip only reorders or tightens existing wording. Evidence that does not appear verbatim in userProfile is discarded.",
      listTip:
        "skillsTips and certificationsTips entries are objects { item, text, requirement }: item is only the bare skill or certification name exactly as it should appear on the CV (e.g. 'Node.js', 'AWS Certified Developer'), text is the one-sentence reason shown to the candidate, requirement follows the rule above.",
    },
    tipWritingRules: [
      "Each tip text is one short sentence describing a specific, concrete change — not a rewrite of the field.",
      "Write tip text in the output language, but copy requirement and evidence verbatim in their source language.",
      "Prefer tips that point at a specific fact already in the profile the candidate should surface, reorder, or lead with.",
      "Do not suggest adding skills, tools, or experience the candidate does not have.",
      "For missing requirements, never suggest fabricating a match; only suggest truthful reframing of what already exists, or suggest nothing for that item.",
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
    tipExamples: {
      goodTip: {
        forItem:
          "Backend Engineer at Acme (profile description: 'Built TypeScript automation for production workflows. Worked with product partners on rollout planning.')",
        jobRequirement: "Build production TypeScript services and collaborate cross-functionally.",
        tip: {
          text: "Mention that you collaborated with product partners on this work — it directly matches the collaboration requirement.",
          requirement: "Build production TypeScript services and collaborate cross-functionally.",
          evidence: "Worked with product partners on rollout planning",
        },
      },
      goodListTip: {
        item: "Node.js",
        text: "Add Node.js to your skills — your projects use it and the role requires it.",
        requirement: "Experience with Node.js backends",
      },
      badTip: {
        forItem: "Built TypeScript automation.",
        invalid: "Mention leading a team of 8 engineers and cutting cloud spend by 40%.",
        reason:
          "This asks the candidate to add unsupported leadership scope and a fabricated metric.",
      },
      emptyIsFine: {
        forItem: "Served coffee and managed the till at a busy cafe.",
        jobRequirement: "Build production TypeScript services.",
        tips: [],
        reason:
          "The item is unrelated to the requirement and there is nothing truthful to suggest — return an empty array rather than stretching a false connection.",
      },
    },
    requiredOutput: {
      matchScore:
        "Integer 0-100. This is accepted for compatibility, but the application recomputes the final score from requirementEvaluations when present.",
      requirementEvaluations:
        "Optional array with one item per scrapedJob.requirements entry: requirement, status matched|partial|missing, priority must|nice, and profile-grounded evidence strings. Do not add CV-only or profile-only facts as requirementEvaluations items.",
      missingSkills: "Skills or criteria from the job that are not evident in the profile",
      missingSkillResources:
        "Optional. 1-3 reputable learning resources for important missingSkills only. Include skill, title, url, type documentation|tutorial|article|video|other, and reason.",
      strongSkills: "Profile skills that strongly match the job",
      summaryTips:
        "0-4 tip objects (see tipShape) for improving the CV summary/headline for this job. Return an empty array if the candidate's existing summary is already strong.",
      coverLetterContent:
        "A complete professional cover letter body grounded in the profile and job posting, ready for user review and without markdown. This field must never be empty.",
      interviewTips: "Practical tips for this interview",
      coverLetterGuidance: "Optional guidance for the cover letter",
      experienceTips:
        "Required array with exactly one item per zero-based userProfile.experience index. `tips` is an array of 0-4 tip objects (see tipShape) with specific, actionable suggestions for improving that item's CV description for this job — not a rewrite. Return an empty array for items that are already strong or irrelevant.",
      skillsTips:
        "0-6 list tip objects (see tipShape), each naming one specific skill from scrapedJob.requirements that is genuinely absent from userProfile.skills but supported elsewhere in the profile (experience, projects, education). Never suggest a skill the profile does not support.",
      educationTips:
        "Required array with exactly one item per zero-based userProfile.education index, same rules as experienceTips.",
      projectTips:
        "Required array with exactly one item per zero-based userProfile.projects index, same rules as experienceTips.",
      gapQuestions:
        "0-5 questions for the candidate, targeting partial or missing must-have requirements (or strong items that lack a measurable outcome) where the candidate may have relevant experience that is simply not written in the profile yet. Each is { question, requirement, fieldType, fieldIndex }: question is one specific, answerable question in the output language that does not presume the answer (e.g. 'Did you run any of these services on Kubernetes? If so, what did you operate?' or 'Roughly how many users did the checkout redesign reach?'); requirement is the scrapedJob.requirements item it targets copied exactly, or an empty string; fieldType is summary|experience|education|project and fieldIndex the zero-based profile index where the answer would belong (0 for summary). Never ask about something the profile already answers. Return an empty array when there is nothing worth asking.",
      certificationsTips:
        "0-4 list tip objects (see tipShape), each naming one specific, genuinely relevant certification the candidate does not yet have listed, only if there is a real signal they hold or are pursuing it — otherwise return an empty array.",
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

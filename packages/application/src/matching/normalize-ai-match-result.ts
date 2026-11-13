import type { AiMatchResultCandidateDto } from "@careerden/contracts";
import type {
  CvListTip,
  CvTip,
  GapQuestion,
  MatchAnalysisResult,
  MissingSkillResource,
  UserProfile,
} from "@careerden/domain";
import { createTipGrounding, type TipGrounding } from "./tip-grounding.js";

type CandidateTip = AiMatchResultCandidateDto["summaryTips"][number];
type CandidateListTip = NonNullable<AiMatchResultCandidateDto["skillsTips"]>[number];
type CandidateGapQuestion = NonNullable<AiMatchResultCandidateDto["gapQuestions"]>[number];

const MAX_GAP_QUESTIONS = 5;

/**
 * Cleans up the lenient candidate the AI provider returned so the rest of the pipeline can assume
 * well-formed data. Everything here is a repair rather than a rejection: the strict
 * `aiMatchResultSchema` gate runs at the end of the use case, and anything discarded here would
 * otherwise have failed that gate and cost the whole analysis.
 */
export function normalizeAiMatchResult(
  candidate: AiMatchResultCandidateDto,
  profile: UserProfile,
  requirements: string[],
): MatchAnalysisResult {
  const grounding = createTipGrounding(profile, requirements);

  return {
    coverLetterContent: candidate.coverLetterContent.trim(),
    matchScore: clampScore(candidate.matchScore),
    requirementEvaluations: candidate.requirementEvaluations
      ?.map((evaluation) => ({
        requirement: evaluation.requirement.trim(),
        status: evaluation.status,
        evidence: cleanStrings(evaluation.evidence),
        ...(evaluation.priority ? { priority: evaluation.priority } : {}),
      }))
      .filter((evaluation) => evaluation.requirement.length > 0),
    missingSkills: cleanStrings(candidate.missingSkills),
    missingSkillResources: candidate.missingSkillResources
      ?.map((resource): MissingSkillResource => ({
        skill: resource.skill.trim(),
        title: resource.title.trim(),
        url: resource.url.trim(),
        type: resource.type,
        reason: resource.reason.trim(),
      }))
      .filter(
        (resource) =>
          resource.skill.length > 0 &&
          resource.title.length > 0 &&
          resource.reason.length > 0 &&
          isHttpUrl(resource.url),
      ),
    strongSkills: cleanStrings(candidate.strongSkills),
    summaryTips: cleanTips(candidate.summaryTips, grounding),
    interviewTips: cleanStrings(candidate.interviewTips),
    coverLetterGuidance: candidate.coverLetterGuidance
      ? cleanStrings(candidate.coverLetterGuidance)
      : undefined,
    experienceTips: normalizeTips(
      candidate.experienceTips,
      "experienceIndex",
      profile.experience.length,
      grounding,
    ),
    skillsTips: candidate.skillsTips ? cleanListTips(candidate.skillsTips, grounding) : undefined,
    educationTips: normalizeTips(
      candidate.educationTips,
      "educationIndex",
      profile.education.length,
      grounding,
    ),
    projectTips: normalizeTips(
      candidate.projectTips,
      "projectIndex",
      profile.projects.length,
      grounding,
    ),
    certificationsTips: candidate.certificationsTips
      ? cleanListTips(candidate.certificationsTips, grounding)
      : undefined,
    gapQuestions: cleanGapQuestions(candidate.gapQuestions, profile, grounding),
  };
}

/**
 * Drops tip entries pointing outside the profile and collapses duplicate indexes (last wins), so
 * downstream index lookups always resolve to a real profile item.
 */
function normalizeTips<K extends "educationIndex" | "experienceIndex" | "projectIndex">(
  entries: Array<Record<K, number> & { tips: CandidateTip[] }> | undefined,
  indexField: K,
  profileCount: number,
  grounding: TipGrounding,
): Array<Record<K, number> & { tips: CvTip[] }> | undefined {
  if (!entries) return undefined;

  const byIndex = new Map<number, CvTip[]>();

  for (const entry of entries) {
    const index = entry[indexField];
    if (!Number.isInteger(index) || index < 0 || index >= profileCount) continue;
    byIndex.set(index, cleanTips(entry.tips, grounding));
  }

  return [...byIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(
      ([index, tips]) => ({ [indexField]: index, tips }) as Record<K, number> & { tips: CvTip[] },
    );
}

/**
 * Keeps gap questions that target a real profile item. The linked requirement is verified like a
 * tip's, and duplicate questions are collapsed.
 */
function cleanGapQuestions(
  questions: CandidateGapQuestion[] | undefined,
  profile: UserProfile,
  grounding: TipGrounding,
): GapQuestion[] | undefined {
  if (!questions) return undefined;
  const counts = {
    experience: profile.experience.length,
    education: profile.education.length,
    project: profile.projects.length,
  };
  const seen = new Set<string>();

  return questions
    .flatMap((candidate): GapQuestion[] => {
      const question = candidate.question.trim().replace(/\s+/g, " ");
      const key = question.toLocaleLowerCase();
      if (!question || seen.has(key)) return [];

      let field: GapQuestion["field"];
      if (candidate.fieldType === "summary") {
        field = { type: "summary" };
      } else {
        const index = candidate.fieldIndex;
        if (!Number.isInteger(index) || index < 0 || index >= counts[candidate.fieldType]) {
          return [];
        }
        field = { type: candidate.fieldType, index };
      }

      seen.add(key);
      const requirement = grounding.requirement(candidate.requirement);
      return [{ question, field, ...(requirement ? { requirement } : {}) }];
    })
    .slice(0, MAX_GAP_QUESTIONS);
}

function cleanTips(tips: CandidateTip[], grounding: TipGrounding): CvTip[] {
  return tips.flatMap((tip) => {
    const text = tip.text.trim();
    if (!text) return [];
    const requirement = grounding.requirement(tip.requirement);
    const evidence = grounding.evidence(tip.evidence);
    return [{ text, ...(requirement ? { requirement } : {}), ...(evidence ? { evidence } : {}) }];
  });
}

/** Drops list tips without a usable item name and collapses duplicate items (first wins). */
function cleanListTips(tips: CandidateListTip[], grounding: TipGrounding): CvListTip[] {
  const seen = new Set<string>();

  return tips.flatMap((tip) => {
    const item = tip.item.trim().replace(/\s+/g, " ");
    const text = tip.text.trim() || item;
    const key = item.toLocaleLowerCase();
    if (!item || item.length > 80 || seen.has(key)) return [];
    seen.add(key);
    const requirement = grounding.requirement(tip.requirement);
    return [{ item, text, ...(requirement ? { requirement } : {}) }];
  });
}

function cleanStrings(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

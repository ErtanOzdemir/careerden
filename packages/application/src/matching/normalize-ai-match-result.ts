import type { AiMatchResultCandidateDto } from "@careerden/contracts";
import type { MatchAnalysisResult, MissingSkillResource, UserProfile } from "@careerden/domain";

/**
 * Cleans up the lenient candidate the AI provider returned so the rest of the pipeline can assume
 * well-formed data. Everything here is a repair rather than a rejection: the strict
 * `aiMatchResultSchema` gate runs at the end of the use case, and anything discarded here would
 * otherwise have failed that gate and cost the whole analysis.
 */
export function normalizeAiMatchResult(
  candidate: AiMatchResultCandidateDto,
  profile: UserProfile,
): MatchAnalysisResult {
  return {
    coverLetterContent: candidate.coverLetterContent.trim(),
    matchScore: clampScore(candidate.matchScore),
    requirementEvaluations: candidate.requirementEvaluations
      ?.map((evaluation) => ({
        requirement: evaluation.requirement.trim(),
        status: evaluation.status,
        evidence: cleanStrings(evaluation.evidence),
      }))
      .filter((evaluation) => evaluation.requirement.length > 0),
    missingSkills: cleanStrings(candidate.missingSkills),
    missingSkillResources: candidate.missingSkillResources
      ?.map(
        (resource): MissingSkillResource => ({
          skill: resource.skill.trim(),
          title: resource.title.trim(),
          url: resource.url.trim(),
          type: resource.type,
          reason: resource.reason.trim(),
        }),
      )
      .filter(
        (resource) =>
          resource.skill.length > 0 &&
          resource.title.length > 0 &&
          resource.reason.length > 0 &&
          isHttpUrl(resource.url),
      ),
    strongSkills: cleanStrings(candidate.strongSkills),
    summaryTips: cleanStrings(candidate.summaryTips),
    interviewTips: cleanStrings(candidate.interviewTips),
    coverLetterGuidance: candidate.coverLetterGuidance
      ? cleanStrings(candidate.coverLetterGuidance)
      : undefined,
    experienceTips: normalizeTips(
      candidate.experienceTips,
      "experienceIndex",
      profile.experience.length,
    ),
    skillsTips: candidate.skillsTips ? cleanStrings(candidate.skillsTips) : undefined,
    educationTips: normalizeTips(
      candidate.educationTips,
      "educationIndex",
      profile.education.length,
    ),
    projectTips: normalizeTips(candidate.projectTips, "projectIndex", profile.projects.length),
    certificationsTips: candidate.certificationsTips
      ? cleanStrings(candidate.certificationsTips)
      : undefined,
  };
}

/**
 * Drops tip entries pointing outside the profile and collapses duplicate indexes (last wins), so
 * downstream index lookups always resolve to a real profile item.
 */
function normalizeTips<K extends "educationIndex" | "experienceIndex" | "projectIndex">(
  entries: Array<Record<K, number> & { tips: string[] }> | undefined,
  indexField: K,
  profileCount: number,
): Array<Record<K, number> & { tips: string[] }> | undefined {
  if (!entries) return undefined;

  const byIndex = new Map<number, string[]>();

  for (const entry of entries) {
    const index = entry[indexField];
    if (!Number.isInteger(index) || index < 0 || index >= profileCount) continue;
    byIndex.set(index, cleanStrings(entry.tips));
  }

  return [...byIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, tips]) => ({ [indexField]: index, tips }) as Record<K, number> & { tips: string[] });
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

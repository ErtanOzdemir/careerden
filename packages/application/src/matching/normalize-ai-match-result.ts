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
    recommendedAchievements: cleanStrings(candidate.recommendedAchievements),
    customizedSummary: candidate.customizedSummary.trim(),
    interviewTips: cleanStrings(candidate.interviewTips),
    coverLetterGuidance: candidate.coverLetterGuidance
      ? cleanStrings(candidate.coverLetterGuidance)
      : undefined,
    experienceEnhancements: normalizeEnhancements(
      candidate.experienceEnhancements,
      "experienceIndex",
      profile.experience.length,
    ),
    skillSuggestions: candidate.skillSuggestions
      ? cleanStrings(candidate.skillSuggestions)
      : undefined,
    educationEnhancements: normalizeEnhancements(
      candidate.educationEnhancements,
      "educationIndex",
      profile.education.length,
    ),
    projectEnhancements: normalizeEnhancements(
      candidate.projectEnhancements,
      "projectIndex",
      profile.projects.length,
    ),
    certificationSuggestions: candidate.certificationSuggestions
      ? cleanStrings(candidate.certificationSuggestions)
      : undefined,
  };
}

/**
 * Drops enhancements pointing outside the profile and collapses duplicate indexes (last wins), so
 * downstream index lookups always resolve to a real profile item.
 */
function normalizeEnhancements<K extends "educationIndex" | "experienceIndex" | "projectIndex">(
  enhancements: Array<Record<K, number> & { enhancedDescription: string }> | undefined,
  indexField: K,
  profileCount: number,
): Array<Record<K, number> & { enhancedDescription?: string }> | undefined {
  if (!enhancements) return undefined;

  const byIndex = new Map<number, string>();

  for (const enhancement of enhancements) {
    const index = enhancement[indexField];
    if (!Number.isInteger(index) || index < 0 || index >= profileCount) continue;
    byIndex.set(index, enhancement.enhancedDescription.trim());
  }

  return [...byIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(
      ([index, enhancedDescription]) =>
        ({
          [indexField]: index,
          ...(enhancedDescription ? { enhancedDescription } : {}),
        }) as Record<K, number> & { enhancedDescription?: string },
    );
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

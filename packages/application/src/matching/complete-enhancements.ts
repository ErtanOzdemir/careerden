import type { AiEnhancementRepairDto } from "@careerden/contracts";
import type { MatchAnalysisResult, UserProfile } from "@careerden/domain";
import {
  fallbackEducationDescription,
  fallbackExperienceDescription,
  fallbackProjectDescription,
} from "@careerden/domain";
import { ApplicationError } from "../application-error.js";

/**
 * Guarantees every profile item reaches the tailored CV with a non-empty description.
 *
 * The AI used to be told it could omit items it judged irrelevant, and the document resolver then
 * fell back to the untouched profile text — which is why tailored output sometimes read exactly
 * like the input, and why sections rendered blank. Completeness is enforced here rather than in the
 * output schema because a schema violation is unrecoverable, whereas a gap can be repaired.
 */

export interface EnhancementIndexes {
  experience: number[];
  education: number[];
  projects: number[];
}

export function findIncompleteIndexes(
  profile: UserProfile,
  result: MatchAnalysisResult,
): EnhancementIndexes {
  return {
    experience: incompleteIndexes(
      profile.experience.length,
      result.experienceEnhancements,
      (enhancement) => enhancement.experienceIndex,
    ),
    education: incompleteIndexes(
      profile.education.length,
      result.educationEnhancements,
      (enhancement) => enhancement.educationIndex,
    ),
    projects: incompleteIndexes(
      profile.projects.length,
      result.projectEnhancements,
      (enhancement) => enhancement.projectIndex,
    ),
  };
}

export function hasIncompleteIndexes(indexes: EnhancementIndexes): boolean {
  return (
    indexes.experience.length > 0 || indexes.education.length > 0 || indexes.projects.length > 0
  );
}

/**
 * Applies a repair response. Repairs only fill gaps — a description the first call got right is
 * never overwritten, so a sloppy repair cannot degrade good output.
 */
export function mergeRepairedEnhancements(
  result: MatchAnalysisResult,
  repair: AiEnhancementRepairDto,
): MatchAnalysisResult {
  return {
    ...result,
    experienceEnhancements: mergeSection(
      result.experienceEnhancements,
      repair.experienceEnhancements,
      "experienceIndex",
    ),
    educationEnhancements: mergeSection(
      result.educationEnhancements,
      repair.educationEnhancements,
      "educationIndex",
    ),
    projectEnhancements: mergeSection(
      result.projectEnhancements,
      repair.projectEnhancements,
      "projectIndex",
    ),
  };
}

/**
 * Fills whatever the AI still left empty with a deterministic description built from the profile
 * item's own facts, and reports which indexes needed it so the caller can record the fallback.
 */
export function fillIncompleteEnhancements(
  profile: UserProfile,
  result: MatchAnalysisResult,
): { result: MatchAnalysisResult; filled: EnhancementIndexes } {
  const filled = findIncompleteIndexes(profile, result);

  return {
    filled,
    result: {
      ...result,
      experienceEnhancements: profile.experience.map((experience, index) => ({
        experienceIndex: index,
        enhancedDescription:
          descriptionAt(result.experienceEnhancements, (item) => item.experienceIndex, index) ??
          fallbackExperienceDescription(experience),
      })),
      educationEnhancements: profile.education.map((education, index) => ({
        educationIndex: index,
        enhancedDescription:
          descriptionAt(result.educationEnhancements, (item) => item.educationIndex, index) ??
          fallbackEducationDescription(education),
      })),
      projectEnhancements: profile.projects.map((project, index) => ({
        projectIndex: index,
        enhancedDescription:
          descriptionAt(result.projectEnhancements, (item) => item.projectIndex, index) ??
          fallbackProjectDescription(project),
      })),
    },
  };
}

/**
 * Final guard before persistence. After the deterministic fill this can only fire on a bug, so it
 * throws rather than papering over the gap.
 */
export function assertEnhancementCompleteness(
  profile: UserProfile,
  result: MatchAnalysisResult,
): void {
  const incomplete = findIncompleteIndexes(profile, result);

  if (hasIncompleteIndexes(incomplete)) {
    throw new ApplicationError(
      "validation",
      `Match analysis is missing tailored descriptions for experience [${incomplete.experience.join(", ")}], education [${incomplete.education.join(", ")}], projects [${incomplete.projects.join(", ")}]`,
    );
  }
}

function incompleteIndexes<T extends { enhancedDescription?: string }>(
  profileCount: number,
  enhancements: T[] | undefined,
  indexOf: (enhancement: T) => number,
): number[] {
  return Array.from({ length: profileCount }, (_, index) => index).filter(
    (index) => descriptionAt(enhancements, indexOf, index) === undefined,
  );
}

function descriptionAt<T extends { enhancedDescription?: string }>(
  enhancements: T[] | undefined,
  indexOf: (enhancement: T) => number,
  index: number,
): string | undefined {
  const description = enhancements?.find((item) => indexOf(item) === index)?.enhancedDescription;

  return description?.trim() ? description.trim() : undefined;
}

function mergeSection<K extends "educationIndex" | "experienceIndex" | "projectIndex">(
  existing: Array<Record<K, number> & { enhancedDescription?: string }> | undefined,
  repaired: Array<Record<K, number> & { enhancedDescription: string }> | undefined,
  indexField: K,
): Array<Record<K, number> & { enhancedDescription?: string }> | undefined {
  if (!repaired?.length) return existing;

  const merged = new Map((existing ?? []).map((item) => [item[indexField], item]));

  for (const candidate of repaired) {
    const index = candidate[indexField];
    const description = candidate.enhancedDescription.trim();
    if (!description) continue;
    if (merged.get(index)?.enhancedDescription?.trim()) continue;
    merged.set(index, {
      ...merged.get(index),
      [indexField]: index,
      enhancedDescription: description,
    } as Record<K, number> & { enhancedDescription?: string });
  }

  return [...merged.values()].sort((left, right) => left[indexField] - right[indexField]);
}

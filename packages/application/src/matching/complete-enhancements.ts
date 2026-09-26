import type { CvTip, MatchAnalysisResult, UserProfile } from "@careerden/domain";

/**
 * Guarantees every profile item has a tips entry, so the tips panel and the apply-tip flow never
 * have to handle a missing index mid-render.
 *
 * Unlike the old full-rewrite design, an empty `tips` array is a legitimate outcome — "this item is
 * already strong for this job" is a real answer, not a failure — so this is pure structural
 * reconciliation (array length == profile length) with no AI repair call and no fallback text
 * generation.
 */
export function fillMissingTipEntries(
  profile: UserProfile,
  result: MatchAnalysisResult,
): MatchAnalysisResult {
  return {
    ...result,
    experienceTips: profile.experience.map((_, index) => ({
      experienceIndex: index,
      tips: tipsAt(result.experienceTips, (item) => item.experienceIndex, index),
    })),
    educationTips: profile.education.map((_, index) => ({
      educationIndex: index,
      tips: tipsAt(result.educationTips, (item) => item.educationIndex, index),
    })),
    projectTips: profile.projects.map((_, index) => ({
      projectIndex: index,
      tips: tipsAt(result.projectTips, (item) => item.projectIndex, index),
    })),
  };
}

function tipsAt<T extends { tips: CvTip[] }>(
  entries: T[] | undefined,
  indexOf: (entry: T) => number,
  index: number,
): CvTip[] {
  return entries?.find((item) => indexOf(item) === index)?.tips ?? [];
}

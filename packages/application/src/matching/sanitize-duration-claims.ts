import type { MatchAnalysisResult, UserProfile } from "@careerden/domain";
import { collectSupportedDurationClaims, sanitizeDurationClaims } from "@careerden/domain";

/**
 * Removes length-of-experience claims the profile does not support.
 *
 * `sanitizeDurationClaims` strips only the offending sentence, falling back to excising the phrase
 * in place rather than returning an empty string. Individual tips that sanitize down to nothing are
 * simply dropped from their array — unlike the old full-rewrite design, a tip has no completeness
 * requirement to preserve a placeholder for.
 */
export function sanitizeMatchAnalysisDurationClaims(
  result: MatchAnalysisResult,
  profile: UserProfile,
  now = new Date(),
): MatchAnalysisResult {
  const supported = collectSupportedDurationClaims(profile, now);
  const sanitize = (value: string): string => sanitizeDurationClaims(value, supported);
  const sanitizeAll = (values: string[]): string[] => values.map(sanitize).filter(Boolean);
  const sanitizeTips = <T extends { tips: string[] }>(entry: T): T => ({
    ...entry,
    tips: sanitizeAll(entry.tips),
  });

  return {
    ...result,
    coverLetterContent: result.coverLetterContent ? sanitize(result.coverLetterContent) : "",
    summaryTips: sanitizeAll(result.summaryTips),
    interviewTips: sanitizeAll(result.interviewTips),
    coverLetterGuidance: result.coverLetterGuidance
      ? sanitizeAll(result.coverLetterGuidance)
      : undefined,
    // `requirement` is quoted from the job posting, not claimed by the candidate: "5+ years of Java"
    // is the employer's ask. Stripping it would also shrink the list `calculateMatchScore` divides
    // by, silently inflating the score. Only the candidate-authored `evidence` is sanitised.
    requirementEvaluations: result.requirementEvaluations?.map((evaluation) => ({
      ...evaluation,
      evidence: sanitizeAll(evaluation.evidence),
    })),
    experienceTips: result.experienceTips?.map(sanitizeTips),
    educationTips: result.educationTips?.map(sanitizeTips),
    projectTips: result.projectTips?.map(sanitizeTips),
    skillsTips: result.skillsTips ? sanitizeAll(result.skillsTips) : undefined,
    certificationsTips: result.certificationsTips
      ? sanitizeAll(result.certificationsTips)
      : undefined,
  };
}

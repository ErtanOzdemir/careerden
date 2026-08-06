import type { MatchAnalysisResult, UserProfile } from "@careerden/domain";
import { collectSupportedDurationClaims, sanitizeDurationClaims } from "@careerden/domain";

/**
 * Removes length-of-experience claims the profile does not support.
 *
 * Unlike the guard this replaced, nothing is emptied and nothing is dropped: `sanitizeDurationClaims`
 * strips only the offending sentence, falling back to excising the phrase in place rather than
 * returning an empty field. Enhancements whose description does empty out stay in the array with no
 * description so the completeness layer can repair or fill them — filtering them here is what used
 * to make items silently disappear from the tailored CV.
 */
export function sanitizeMatchAnalysisDurationClaims(
  result: MatchAnalysisResult,
  profile: UserProfile,
  now = new Date(),
): MatchAnalysisResult {
  const supported = collectSupportedDurationClaims(profile, now);
  const sanitize = (value: string): string => sanitizeDurationClaims(value, supported);
  const sanitizeAll = (values: string[]): string[] => values.map(sanitize).filter(Boolean);
  const sanitizeEnhancement = <T extends { enhancedDescription?: string }>(enhancement: T): T => {
    const enhancedDescription = enhancement.enhancedDescription
      ? sanitize(enhancement.enhancedDescription)
      : "";

    return {
      ...enhancement,
      ...(enhancedDescription ? { enhancedDescription } : { enhancedDescription: undefined }),
    };
  };

  return {
    ...result,
    coverLetterContent: result.coverLetterContent ? sanitize(result.coverLetterContent) : "",
    customizedSummary: sanitize(result.customizedSummary),
    recommendedAchievements: sanitizeAll(result.recommendedAchievements),
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
    experienceEnhancements: result.experienceEnhancements?.map(sanitizeEnhancement),
    educationEnhancements: result.educationEnhancements?.map(sanitizeEnhancement),
    projectEnhancements: result.projectEnhancements?.map(sanitizeEnhancement),
    // Skill and certification labels are too short to carry a duration claim, and filtering them
    // would quietly shorten the lists the user sees.
  };
}

import { containsTerm } from "./cv-text.js";

/**
 * Orders skills so the ones this job asks for come first: a skill named among the job's keywords
 * scores highest, then one point per requirement that mentions it. Ties keep the candidate's own
 * order, so an irrelevant list is returned unchanged.
 */
export function orderSkillsByRelevance(
  skills: string[],
  keywords: string[],
  requirements: string[],
): string[] {
  const score = (skill: string): number =>
    (keywords.some((keyword) => containsTerm(keyword, skill) || containsTerm(skill, keyword))
      ? 3
      : 0) + requirements.filter((requirement) => containsTerm(requirement, skill)).length;

  return skills
    .map((skill, index) => ({ skill, index, score: score(skill) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ skill }) => skill);
}

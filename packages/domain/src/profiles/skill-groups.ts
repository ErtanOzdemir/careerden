/**
 * Skill groups and their pure helpers live in `@careerden/contracts` so `apps/web` can share them.
 * They are re-exported here for `@careerden/domain` consumers.
 */
export type { ProfileSkillGroup } from "@careerden/contracts";
export {
  groupSkillsBySkillGroups,
  hasNamedSkillGroups,
  normalizeSkillGroups,
  profileSkills,
  replaceProfileSkills,
  SUGGESTED_SKILL_GROUP_NAMES,
  UNCATEGORIZED_SKILL_GROUP_LABEL,
} from "@careerden/contracts";

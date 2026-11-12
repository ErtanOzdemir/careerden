/**
 * Profile skills grouped under user-named categories such as "DevOps" or "Frontend".
 *
 * These live in `contracts` rather than `domain` so `apps/web` can share them with the server when
 * it renders the CV preview; `domain` re-exports everything here.
 *
 * A group with an empty name holds the skills the user has not categorized. Skills are unique across
 * all groups, compared without case or surrounding whitespace, so every skill has exactly one group.
 */
export interface ProfileSkillGroup {
  name: string;
  skills: string[];
}

/** The heading shown for uncategorized skills when they sit next to named groups. */
export const UNCATEGORIZED_SKILL_GROUP_LABEL = "Other";

/** Category names offered as suggestions; any other name is allowed too. */
export const SUGGESTED_SKILL_GROUP_NAMES = [
  "DevOps",
  "Frontend",
  "Backend",
  "Mobile",
  "Data",
  "Cloud",
  "Languages",
  "Tools",
] as const;

/** Every skill in group order, as the flat list matching and readiness read. */
export function profileSkills(groups: readonly ProfileSkillGroup[]): string[] {
  return groups.flatMap((group) => group.skills);
}

/**
 * Trims names and skills, drops empty skills and groups, merges groups whose names differ only in
 * case, keeps the first occurrence of a repeated skill, and moves uncategorized skills last.
 */
export function normalizeSkillGroups(groups: readonly ProfileSkillGroup[]): ProfileSkillGroup[] {
  const byName = new Map<string, ProfileSkillGroup>();
  const seenSkills = new Set<string>();

  for (const group of groups) {
    const name = group.name.trim().replace(/\s+/g, " ");
    const nameKey = skillKey(name);
    const target = byName.get(nameKey) ?? { name, skills: [] };

    for (const rawSkill of group.skills) {
      const skill = rawSkill.trim();
      const key = skillKey(skill);
      if (!key || seenSkills.has(key)) continue;
      seenSkills.add(key);
      target.skills.push(skill);
    }

    byName.set(nameKey, target);
  }

  const normalized = [...byName.values()].filter((group) => group.skills.length > 0);
  return [
    ...normalized.filter((group) => group.name),
    ...normalized.filter((group) => !group.name),
  ];
}

/**
 * Groups a document's own skill list by the profile's categories, keeping the document's skill
 * order inside each group. Named groups appear in the order their first skill does, so a skill moved
 * to the front pulls its category forward; skills outside every profile group, such as ones added
 * from a tip, join the uncategorized group, which always comes last.
 */
export function groupSkillsBySkillGroups(
  skills: readonly string[],
  groups: readonly ProfileSkillGroup[],
): ProfileSkillGroup[] {
  const groupNameBySkill = new Map<string, string>();
  for (const group of groups) {
    for (const skill of group.skills) {
      const key = skillKey(skill);
      if (!groupNameBySkill.has(key)) groupNameBySkill.set(key, group.name.trim());
    }
  }

  return normalizeSkillGroups(
    skills.map((skill) => ({ name: groupNameBySkill.get(skillKey(skill)) ?? "", skills: [skill] })),
  );
}

/**
 * Replaces the skills with a new flat list, such as one typed as comma-separated text, while keeping
 * each remaining skill in its category. New skills join the uncategorized group.
 */
export function replaceProfileSkills(
  groups: readonly ProfileSkillGroup[],
  skills: readonly string[],
): ProfileSkillGroup[] {
  const kept = new Set(skills.map(skillKey));
  return normalizeSkillGroups([
    ...groups.map((group) => ({
      name: group.name,
      skills: group.skills.filter((skill) => kept.has(skillKey(skill))),
    })),
    { name: "", skills: [...skills] },
  ]);
}

/** True when the groups need headings: anything other than a single uncategorized group. */
export function hasNamedSkillGroups(groups: readonly ProfileSkillGroup[]): boolean {
  return groups.some((group) => group.name.trim().length > 0);
}

function skillKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

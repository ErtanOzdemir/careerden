import type { DocumentContent } from "@careerden/domain";

/**
 * Temporary read shim for the window in which a worker running post-migration code can still read a
 * row the migration has not reached: Knex runs at API startup, but the workers start independently.
 *
 * It only strips the legacy `achievements` keys so the stored shape matches the current schema; it
 * does not merge their text, because migration 20260806000000 does that properly.
 *
 * Delete this together with its call site one release after that migration has run everywhere.
 */
export function dropLegacyAchievements(content: DocumentContent): DocumentContent {
  const withoutAchievements = <T extends object>(item: T): T => {
    const { achievements: _achievements, ...rest } = item as T & { achievements?: unknown };
    return rest as T;
  };

  return {
    ...content,
    experienceEnhancements: content.experienceEnhancements?.map(withoutAchievements) ?? [],
    educationEnhancements: content.educationEnhancements?.map(withoutAchievements),
    projectEnhancements: content.projectEnhancements?.map(withoutAchievements),
  };
}

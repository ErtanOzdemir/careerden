import { profileSkills } from "./skill-groups.js";
import type { UserProfile } from "./user-profile.js";

export type ProfileReadinessState = "ready" | "warning" | "blocked";
export type ProfileReadinessWarning = "evidence" | "positioning" | "skills";

export interface ProfileReadiness {
  state: ProfileReadinessState;
  warnings: ProfileReadinessWarning[];
}

export function assessProfileReadiness(profile: UserProfile): ProfileReadiness {
  const hasPositioning = hasText(profile.profession, profile.headline, profile.summary);
  const hasSkills = profileSkills(profile.skillGroups).some((skill) => skill.trim().length > 0);
  const hasEvidence =
    profile.experience.length > 0 ||
    profile.projects.length > 0 ||
    profile.education.length > 0 ||
    profile.certifications.length > 0;

  if (!hasPositioning && !hasSkills && !hasEvidence) {
    return {
      state: "blocked",
      warnings: ["positioning", "skills", "evidence"],
    };
  }

  const warnings: ProfileReadinessWarning[] = [];
  if (!hasPositioning) warnings.push("positioning");
  if (!hasSkills) warnings.push("skills");
  if (!hasEvidence) warnings.push("evidence");

  return {
    state: warnings.length > 0 ? "warning" : "ready",
    warnings,
  };
}

function hasText(...values: Array<string | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

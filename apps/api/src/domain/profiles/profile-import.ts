import type {
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UpdateUserProfileInput,
  UserProfile,
} from "@careerden/domain";

/**
 * Profile details read from a CV, shown to the user before anything is saved. The user may drop
 * whole sections before applying it, so every field is optional.
 */
export interface ProfileImportDraft {
  fullName?: string;
  email?: string;
  profession?: string;
  headline?: string;
  location?: string;
  links?: string[];
  summary?: string;
  skills?: string[];
  certifications?: string[];
  experience?: ProfileExperience[];
  education?: ProfileEducation[];
  projects?: ProfileProject[];
}

type ScalarField = "fullName" | "email" | "profession" | "headline" | "location" | "summary";

const scalarFields: ScalarField[] = [
  "fullName",
  "email",
  "profession",
  "headline",
  "location",
  "summary",
];

/**
 * Turns an imported draft into a profile update that never overwrites what the user already wrote:
 * single-value fields are filled only while empty, and list entries are appended unless the profile
 * already has a matching one. Returns only the fields that change.
 */
export function mergeProfileImport(
  profile: UserProfile,
  draft: ProfileImportDraft,
): UpdateUserProfileInput {
  const update: UpdateUserProfileInput = {};

  for (const field of scalarFields) {
    const value = draft[field]?.trim();
    if (value && !profile[field]?.trim()) update[field] = value;
  }

  const links = appendMissing(profile.links, draft.links, linkKey);
  if (links) update.links = links;
  const skills = appendMissing(profile.skills, draft.skills, textKey);
  if (skills) update.skills = skills;
  const certifications = appendMissing(profile.certifications, draft.certifications, textKey);
  if (certifications) update.certifications = certifications;
  const experience = appendMissing(profile.experience, draft.experience, (item) =>
    textKey(`${item.company}\n${item.title}`),
  );
  if (experience) update.experience = experience;
  const education = appendMissing(profile.education, draft.education, (item) =>
    textKey(`${item.institution}\n${item.degree ?? ""}`),
  );
  if (education) update.education = education;
  const projects = appendMissing(profile.projects, draft.projects, (item) => textKey(item.name));
  if (projects) update.projects = projects;

  return update;
}

// Returns the combined list, or undefined when the draft adds nothing new.
function appendMissing<T>(
  current: T[],
  imported: T[] | undefined,
  key: (item: T) => string,
): T[] | undefined {
  const seen = new Set(current.map(key));
  const added = (imported ?? []).filter((item) => {
    const itemKey = key(item);
    if (!itemKey || seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });

  return added.length > 0 ? [...current, ...added] : undefined;
}

function textKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Treats links that differ only in scheme, `www.`, case, or a trailing slash as the same link. */
export function linkKey(value: string): string {
  return textKey(value)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "");
}

import { emptyRichDocument, richDocumentFromText } from "@careerden/contracts";
import type { ApiDocumentContent, ApiProfile } from "../api/types.js";

/** A profile can preview a resume once it has a name and at least one role. */
export function hasResumeContent(profile: ApiProfile): boolean {
  return Boolean(profile.fullName.trim()) && profile.experience.length > 0;
}

export function baseContentFor(profile: ApiProfile): ApiDocumentContent {
  return {
    customizedSummary:
      profile.summaryRichText ??
      (profile.summary ? richDocumentFromText(profile.summary) : emptyRichDocument()),
    experienceEnhancements: [],
    skillSuggestions: [],
    educationEnhancements: [],
    projectEnhancements: [],
    certificationSuggestions: [],
  };
}

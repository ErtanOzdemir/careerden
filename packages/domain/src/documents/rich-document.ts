import type { RichDocument } from "@careerden/contracts";
import {
  emptyRichDocument,
  mergeRichDocumentsAsProse,
  richDocumentFromText,
} from "@careerden/contracts";
import type { ProfileProject, UserProfile } from "../profiles/user-profile.js";

/**
 * The rich-text shape and its pure helpers live in `@careerden/contracts` so `apps/web` can share
 * them without depending on this package. They are re-exported here so existing
 * `@careerden/domain` consumers keep working unchanged.
 */
export type {
  RichBlock,
  RichDocument,
  RichHeading,
  RichList,
  RichListItem,
  RichParagraph,
  RichTable,
  RichTableCell,
  RichTableRow,
  RichTextAlignment,
  RichTextMark,
  RichTextNode,
} from "@careerden/contracts";
export {
  emptyRichDocument,
  mergeRichDocumentsAsProse,
  richDocumentFromText,
  richDocumentToPlainText,
} from "@careerden/contracts";

export const DOCUMENT_CONTENT_FORMAT_VERSION = 2 as const;

export interface DocumentContentExperienceEnhancement {
  experienceIndex: number;
  description?: RichDocument;
}

export interface DocumentContentEducationEnhancement {
  educationIndex: number;
  description?: RichDocument;
}

export interface DocumentContentProjectEnhancement {
  projectIndex: number;
  description?: RichDocument;
}

export interface DocumentContent {
  coverLetterContent?: RichDocument;
  customizedSummary: RichDocument;
  formatVersion?: typeof DOCUMENT_CONTENT_FORMAT_VERSION;
  experienceEnhancements: DocumentContentExperienceEnhancement[];
  skillSuggestions?: string[];
  educationEnhancements?: DocumentContentEducationEnhancement[];
  projectEnhancements?: DocumentContentProjectEnhancement[];
  certificationSuggestions?: string[];
  /**
   * Identifiers of tips and gap questions the candidate already accepted for this application, so
   * the tips panel can keep them applied across visits. Reset with the rest of the content whenever
   * the analysis is re-run, since the tips themselves change.
   */
  appliedTips?: string[];
}

/**
 * Builds the editable document the user customises, seeded from their own profile text — not from
 * AI output. The CV always starts as the candidate's own words; AI involvement is opt-in per field,
 * one improvement tip at a time (see ApplyDocumentFieldTipUseCase in `@careerden/application`), not
 * a wholesale rewrite applied up front.
 *
 * One entry is emitted per profile item so the customiser never has to fall back to an untouched
 * value mid-render — every index is already populated.
 */
export function documentContentFromProfile(
  profile: Pick<
    UserProfile,
    | "certifications"
    | "education"
    | "experience"
    | "projects"
    | "skills"
    | "summary"
    | "summaryRichText"
  >,
  analysis: { coverLetterContent?: string },
): DocumentContent {
  return {
    coverLetterContent: richDocumentFromText(analysis.coverLetterContent ?? ""),
    customizedSummary:
      toRichDocument(profile.summary, profile.summaryRichText) ?? emptyRichDocument(),
    formatVersion: DOCUMENT_CONTENT_FORMAT_VERSION,
    experienceEnhancements: profile.experience.map((experience, index) => ({
      experienceIndex: index,
      description: toRichDocument(experience.description, experience.descriptionRichText),
    })),
    skillSuggestions: [...profile.skills],
    educationEnhancements: profile.education.map((education, index) => ({
      educationIndex: index,
      description: toRichDocument(education.description, education.descriptionRichText),
    })),
    projectEnhancements: profile.projects.map((project, index) => ({
      projectIndex: index,
      description: profileProjectDescriptionAsProse(project),
    })),
    certificationSuggestions: [...profile.certifications],
  };
}

export function profileProjectDescriptionAsProse(
  project: Pick<ProfileProject, "achievements" | "description" | "descriptionRichText">,
): RichDocument | undefined {
  return mergeRichDocumentsAsProse(
    toRichDocument(project.description, project.descriptionRichText),
    ...project.achievements.map(richDocumentFromText),
  );
}

function toRichDocument(
  text: string | undefined,
  richText: RichDocument | undefined,
): RichDocument | undefined {
  return richText ?? (text ? richDocumentFromText(text) : undefined);
}

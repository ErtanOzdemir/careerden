import type { RichDocument } from "@careerden/contracts";
import { mergeRichDocumentsAsProse, richDocumentFromText } from "@careerden/contracts";
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

export interface DocumentContentItemSelection {
  description?: "ai" | "original";
}

export interface DocumentContentSelections {
  customizedSummary?: "ai" | "original";
  skills?: "ai" | "original";
  certifications?: "ai" | "original";
  experience: Record<string, DocumentContentItemSelection>;
  education: Record<string, DocumentContentItemSelection>;
  projects: Record<string, DocumentContentItemSelection>;
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
  selections?: DocumentContentSelections;
}

/**
 * Builds the editable document the user customises from a finished match analysis.
 *
 * One entry is emitted per profile item rather than per AI enhancement: the analysis guarantees a
 * tailored description for every index, and materialising them all keeps the customiser from
 * silently falling back to the untouched profile text when an entry is missing.
 */
export function documentContentFromMatchAnalysis(
  profile: Pick<UserProfile, "education" | "experience" | "projects">,
  analysis: {
    coverLetterContent?: string;
    customizedSummary: string;
    experienceEnhancements?: Array<{ experienceIndex: number; enhancedDescription?: string }>;
    skillSuggestions?: string[];
    educationEnhancements?: Array<{ educationIndex: number; enhancedDescription?: string }>;
    projectEnhancements?: Array<{ projectIndex: number; enhancedDescription?: string }>;
    certificationSuggestions?: string[];
  },
): DocumentContent {
  return {
    coverLetterContent: richDocumentFromText(analysis.coverLetterContent ?? ""),
    customizedSummary: richDocumentFromText(analysis.customizedSummary),
    formatVersion: DOCUMENT_CONTENT_FORMAT_VERSION,
    experienceEnhancements: profile.experience.map((_, index) => ({
      experienceIndex: index,
      ...toDescription(
        analysis.experienceEnhancements?.find((item) => item.experienceIndex === index)
          ?.enhancedDescription,
      ),
    })),
    skillSuggestions: analysis.skillSuggestions ?? [],
    educationEnhancements: profile.education.map((_, index) => ({
      educationIndex: index,
      ...toDescription(
        analysis.educationEnhancements?.find((item) => item.educationIndex === index)
          ?.enhancedDescription,
      ),
    })),
    projectEnhancements: profile.projects.map((_, index) => ({
      projectIndex: index,
      ...toDescription(
        analysis.projectEnhancements?.find((item) => item.projectIndex === index)
          ?.enhancedDescription,
      ),
    })),
    certificationSuggestions: analysis.certificationSuggestions ?? [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
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

function toDescription(text: string | undefined): { description?: RichDocument } {
  return text ? { description: richDocumentFromText(text) } : {};
}

function toRichDocument(
  text: string | undefined,
  richText: RichDocument | undefined,
): RichDocument | undefined {
  return richText ?? (text ? richDocumentFromText(text) : undefined);
}

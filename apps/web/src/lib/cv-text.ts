import type { DocumentFieldRef } from "../contracts/documents/field-ref.js";
import type { RichDocument } from "@careerden/contracts";
import { richDocumentToPlainText } from "@careerden/contracts";
import type { ApiDocumentContent, ApiProfile } from "../api/types.js";

/** One tailorable CV field's current draft text, split into lines (paragraphs and list items). */
export interface CvFieldText {
  field: DocumentFieldRef;
  label: string;
  lines: string[];
}

/** The prose fields of the draft CV in document order, labelled the way the tips panel labels them. */
export function draftCvFields(content: ApiDocumentContent, profile?: ApiProfile): CvFieldText[] {
  const fields: CvFieldText[] = [
    { field: { type: "summary" }, label: "Summary", lines: lines(content.customizedSummary) },
  ];

  for (const item of content.experienceEnhancements) {
    const experience = profile?.experience[item.experienceIndex];
    fields.push({
      field: { type: "experience", index: item.experienceIndex },
      label: experience
        ? `${experience.title} · ${experience.company}`
        : `Experience ${item.experienceIndex + 1}`,
      lines: lines(item.description),
    });
  }
  for (const item of content.projectEnhancements) {
    fields.push({
      field: { type: "project", index: item.projectIndex },
      label: profile?.projects[item.projectIndex]?.name ?? `Project ${item.projectIndex + 1}`,
      lines: lines(item.description),
    });
  }
  for (const item of content.educationEnhancements) {
    fields.push({
      field: { type: "education", index: item.educationIndex },
      label:
        profile?.education[item.educationIndex]?.institution ??
        `Education ${item.educationIndex + 1}`,
      lines: lines(item.description),
    });
  }

  return fields;
}

/** All text a recruiter or ATS would read on the draft CV, including titles and list sections. */
export function draftCvSearchText(content: ApiDocumentContent, profile?: ApiProfile): string {
  return [
    profile?.headline,
    profile?.profession,
    ...(profile?.experience.map((experience) => experience.title) ?? []),
    ...(profile?.projects.flatMap((project) => [project.name, ...project.skills]) ?? []),
    ...(profile?.education.flatMap((education) => [education.degree, education.field]) ?? []),
    ...draftCvFields(content, profile).flatMap((field) => field.lines),
    ...content.skillSuggestions,
    ...content.certificationSuggestions,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Whether `term` occurs in `text` as a whole term, so "Go" does not match "Google" but "Node.js"
 * and "C++" still match. Case-insensitive.
 */
export function containsTerm(text: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function lines(document: RichDocument | undefined): string[] {
  if (!document) return [];
  return richDocumentToPlainText(document)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

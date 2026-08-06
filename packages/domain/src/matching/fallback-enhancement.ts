import {
  profileProjectDescriptionAsProse,
  richDocumentToPlainText,
} from "../documents/rich-document.js";
import type {
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
} from "../profiles/user-profile.js";

/**
 * Deterministic descriptions used when the AI leaves a profile item without one, even after a
 * repair call. Every profile item must reach the CV with text, so these can never return empty.
 *
 * They compress rather than decorate: the document templates already render title, company,
 * institution, and project name as their own fields, so prefixing those facts would only duplicate
 * what the reader already sees. Where the original is a single clean sentence the result equals it
 * — that is honest, and the caller records a fallback event so it is visible rather than silent.
 */

const MAX_FALLBACK_SENTENCES = 2;

export function compressToProse(text: string, maxSentences = MAX_FALLBACK_SENTENCES): string {
  const sentences = text
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/^[\s*•·▪◦\-–—]+/, "").split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.replaceAll(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));

  return sentences.join(" ");
}

export function fallbackExperienceDescription(experience: ProfileExperience): string {
  const compressed = compressToProse(experience.description ?? "");
  if (compressed) return compressed;

  return `${experience.title} at ${experience.company}.`;
}

export function fallbackEducationDescription(education: ProfileEducation): string {
  const compressed = compressToProse(education.description ?? "");
  if (compressed) return compressed;

  const study = [education.degree, education.field].filter(Boolean).join(" in ");

  return study ? `${study} at ${education.institution}.` : `Studied at ${education.institution}.`;
}

export function fallbackProjectDescription(project: ProfileProject): string {
  const prose = profileProjectDescriptionAsProse(project);
  const compressed = compressToProse(prose ? richDocumentToPlainText(prose) : "");
  if (compressed) return compressed;

  return project.skills.length > 0
    ? `${project.name}, built with ${project.skills.join(", ")}.`
    : `${project.name}.`;
}

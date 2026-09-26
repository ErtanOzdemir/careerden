import type { RichDocument, UserProfile } from "@careerden/domain";
import { richDocumentToPlainText } from "@careerden/domain";

/**
 * Verifies the links an AI tip claims before they are trusted downstream: a requirement must match
 * one of the scraped job requirements, and evidence must be a phrase that actually appears in the
 * profile. Anything unverifiable is dropped (the tip itself survives) so the apply-tip revision is
 * never grounded in a fact the model paraphrased or invented.
 */
export interface TipGrounding {
  requirement(value: string): string | undefined;
  evidence(value: string): string | undefined;
}

/** Evidence shorter than this is too generic ("React") to prove anything about the profile. */
const MIN_EVIDENCE_LENGTH = 8;

export function createTipGrounding(profile: UserProfile, requirements: string[]): TipGrounding {
  const requirementsByKey = new Map(
    requirements.map((requirement) => [normalizeForMatch(requirement), requirement]),
  );
  const profileText = normalizeForMatch(profileCorpus(profile).join("\n"));

  return {
    requirement(value) {
      const key = normalizeForMatch(value);
      return key ? requirementsByKey.get(key) : undefined;
    },
    evidence(value) {
      const trimmed = value.trim().replace(/\s+/g, " ");
      const key = normalizeForMatch(trimmed);
      return key.length >= MIN_EVIDENCE_LENGTH && profileText.includes(key) ? trimmed : undefined;
    },
  };
}

function profileCorpus(profile: UserProfile): string[] {
  return [
    profile.headline,
    profile.profession,
    plainText(profile.summary, profile.summaryRichText),
    ...profile.skills,
    ...profile.certifications,
    ...profile.experience.flatMap((experience) => [
      experience.title,
      experience.company,
      plainText(experience.description, experience.descriptionRichText),
    ]),
    ...profile.education.flatMap((education) => [
      education.institution,
      education.degree,
      education.field,
      plainText(education.description, education.descriptionRichText),
    ]),
    ...profile.projects.flatMap((project) => [
      project.name,
      plainText(project.description, project.descriptionRichText),
      ...project.skills,
      ...project.achievements,
    ]),
  ].filter((value): value is string => Boolean(value));
}

function plainText(text: string | undefined, richText: RichDocument | undefined): string {
  return [text, richText ? richDocumentToPlainText(richText) : undefined]
    .filter(Boolean)
    .join("\n");
}

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

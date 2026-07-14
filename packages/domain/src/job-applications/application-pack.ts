export type ApplicationPackTone = "professional" | "concise" | "creative";

export interface ApplicationPackPreferences {
  language: string;
  tone: ApplicationPackTone;
  cvTemplateId?: string;
  coverLetterTemplateId?: string;
}

export const defaultApplicationPackPreferences: ApplicationPackPreferences = {
  language: "auto",
  tone: "professional",
};

export function normalizeApplicationPackPreferences(
  input?: Partial<ApplicationPackPreferences> | Record<string, unknown>,
): ApplicationPackPreferences {
  const language =
    typeof input?.language === "string" && input.language.trim()
      ? input.language
      : defaultApplicationPackPreferences.language;
  const tone = isApplicationPackTone(input?.tone)
    ? input.tone
    : defaultApplicationPackPreferences.tone;
  const cvTemplateId = nonEmptyString(input?.cvTemplateId);
  const coverLetterTemplateId = nonEmptyString(input?.coverLetterTemplateId);

  return {
    language,
    tone,
    ...(cvTemplateId ? { cvTemplateId } : {}),
    ...(coverLetterTemplateId ? { coverLetterTemplateId } : {}),
  };
}

function isApplicationPackTone(value: unknown): value is ApplicationPackTone {
  return value === "professional" || value === "concise" || value === "creative";
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

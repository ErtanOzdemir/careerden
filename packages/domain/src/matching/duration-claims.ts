import { profileSkills } from "../profiles/skill-groups.js";
import type { UserProfile } from "../profiles/user-profile.js";

/**
 * Guards against the AI stating a length of experience the profile does not support.
 *
 * The guard is deliberately surgical: an unsupported claim removes the sentence carrying it, never
 * the whole field. If every sentence carries one, the offending phrases are excised in place
 * instead, so a single bad claim cannot empty a cover letter or summary that has other content.
 */

const numericDurationPattern = /\b(\d{1,2})\s*(?:\+\s*)?(years?|yrs?)\b/gi;
const wordDurationPattern =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\+\s*)?(years?|yrs?)\b/gi;
const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export function extractDurationClaims(value: string): string[] {
  const claims = new Set<string>();

  for (const match of value.matchAll(numericDurationPattern)) {
    claims.add(`${match[1]} year`);
  }

  for (const match of value.matchAll(wordDurationPattern)) {
    const number = numberWords[match[1]?.toLowerCase() ?? ""];
    if (number) claims.add(`${number} year`);
  }

  return [...claims];
}

export function collectSupportedDurationClaims(
  profile: UserProfile,
  now = new Date(),
): Set<string> {
  const written = [
    profile.profession,
    profile.headline,
    profile.summary,
    ...profileSkills(profile.skillGroups),
    ...profile.experience.flatMap((experience) => [
      experience.title,
      experience.company,
      experience.description,
    ]),
    ...profile.education.flatMap((education) => [
      education.institution,
      education.degree,
      education.field,
      education.description,
    ]),
    ...profile.certifications,
    ...profile.projects.flatMap((project) => [
      project.name,
      project.description,
      ...project.skills,
      ...project.achievements,
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap(extractDurationClaims);

  return new Set([...written, ...durationClaimsFromDates(profile, now)]);
}

/**
 * Durations the profile's own dates make true. Without this, "four years at Acme" reads as an
 * unsupported claim purely because the profile spells the span out in dates rather than in prose.
 *
 * Every whole year up to a span is authorised, not just the exact total, because a candidate
 * writing "over 3 years" about a 5-year role is understating, not inventing.
 */
export function durationClaimsFromDates(profile: UserProfile, now = new Date()): Set<string> {
  const claims = new Set<string>();
  const starts: number[] = [];
  const ends: number[] = [];

  for (const experience of profile.experience) {
    const start = parseProfileDate(experience.startDate);
    if (start === undefined) continue;
    const end = parseProfileDate(experience.endDate) ?? now.getTime();
    if (end < start) continue;
    starts.push(start);
    ends.push(end);
    addWholeYearsUpTo(claims, wholeYearsBetween(start, end));
  }

  if (starts.length > 0) {
    addWholeYearsUpTo(claims, wholeYearsBetween(Math.min(...starts), Math.max(...ends)));
  }

  return claims;
}

/**
 * Counted in calendar years rather than by dividing elapsed milliseconds: a fixed 365.25-day year
 * reports a Jan-2022 to Jan-2024 role as one year whenever no leap day falls inside it, which would
 * strip a claim the profile plainly supports.
 */
function wholeYearsBetween(start: number, end: number): number {
  const from = new Date(start);
  const to = new Date(end);
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const reachedAnniversary =
    to.getUTCMonth() > from.getUTCMonth() ||
    (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() >= from.getUTCDate());

  return Math.max(0, reachedAnniversary ? years : years - 1);
}

/**
 * Removes only the sentences carrying an unsupported duration claim, preserving paragraph breaks.
 * Returns an empty string when every sentence was unsupported — callers should fall back to
 * {@link redactDurationPhrases} rather than accept that.
 */
export function stripUnsupportedDurationSentences(text: string, supported: Set<string>): string {
  return text
    .split(/\r?\n/)
    .map((paragraph) =>
      splitSentences(paragraph)
        .filter((sentence) => isSupported(sentence, supported))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

/**
 * Last-resort rewrite: keeps every sentence but cuts the unsupported duration phrase out of it.
 *
 * A lead-in preposition survives only when the phrase ends in "of", because that word then governs
 * what follows: "with 9 years of TypeScript" -> "with TypeScript", while "delivered over 9 years"
 * -> "delivered" rather than a dangling "delivered over".
 */
export function redactDurationPhrases(text: string, supported: Set<string>): string {
  const leadIn =
    "(\\b(?:with|over|of|for|nearly|about|around|approximately|more\\s+than|at\\s+least|up\\s+to)\\s+)?";
  const duration = `\\b(?:\\d{1,2}|${Object.keys(numberWords).join("|")})\\s*(?:\\+\\s*)?(?:years?|yrs?)\\b`;
  const pattern = new RegExp(`${leadIn}${duration}(\\s+of\\b)?`, "gi");

  const redacted = text.replaceAll(pattern, (match, lead: string | undefined, governedOf) =>
    isSupported(match, supported) ? match : governedOf ? (lead ?? "") : " ",
  );

  return redacted
    .split(/\r?\n/)
    .map((paragraph) =>
      paragraph
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\s+([,.;:!?])/g, "$1")
        .replaceAll(/([([])\s+/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

/**
 * The entry point callers should use: strip unsupported sentences, and if that would empty the
 * field, redact the phrases in place instead so the surrounding wording survives.
 *
 * Text consisting of nothing but an unsupported claim ("9 yrs") still returns empty — there is no
 * truthful remainder to keep. Callers that need a guaranteed value fall back to profile-grounded
 * text at that point; see `withRequiredNarrative` in run-match-analysis.use-case.ts.
 */
export function sanitizeDurationClaims(text: string, supported: Set<string>): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const stripped = stripUnsupportedDurationSentences(trimmed, supported).trim();
  if (stripped) return stripped;

  return redactDurationPhrases(trimmed, supported).trim();
}

function isSupported(value: string, supported: Set<string>): boolean {
  return extractDurationClaims(value).every((claim) => supported.has(claim));
}

/**
 * Abbreviations ("e.g.", "Inc.") and decimals ("3.5 years") make a pure `[.!?]` split over-eager.
 * Guarding the common cases keeps a stray fragment from being dropped on its own; anything that
 * still slips through only ever costs a smaller fragment, and `sanitizeDurationClaims` falls back
 * to redaction rather than accepting the empty result.
 */
function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .reduce<string[]>((sentences, chunk) => {
      const previous = sentences.at(-1);
      if (previous !== undefined && endsWithAbbreviation(previous)) {
        sentences[sentences.length - 1] = `${previous} ${chunk}`;
        return sentences;
      }
      sentences.push(chunk);
      return sentences;
    }, [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const abbreviationPattern =
  /(?:\b[A-Za-z]|\b(?:e\.g|i\.e|etc|vs|Inc|Ltd|Co|Corp|Dr|Mr|Ms|St)|\d)\.$/;

function endsWithAbbreviation(sentence: string): boolean {
  return abbreviationPattern.test(sentence);
}

function addWholeYearsUpTo(claims: Set<string>, years: number): void {
  for (let year = 1; year <= years; year += 1) {
    claims.add(`${year} year`);
  }
}

/**
 * Profile dates are free-form strings, so parsing is strict on purpose: a garbage value must not
 * silently authorise a duration claim. Only `YYYY`, `YYYY-MM`, and `YYYY-MM-DD` are accepted.
 */
function parseProfileDate(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  return Date.UTC(year, month - 1, day);
}

import type { ScrapedJob } from "../scraping/scraped-data.js";
import type { UserProfile } from "../profiles/user-profile.js";
import { compressToProse } from "./fallback-enhancement.js";

/**
 * Deterministic cover letter used when the model returns an empty body, or when every sentence it
 * wrote carried an unsupported duration claim. A blank cover letter renders as a blank page in the
 * generated PDF, so this path exists to make that outcome unreachable.
 *
 * It states only facts already present in the profile and the posting — no durations, no metrics,
 * no claimed seniority — so it is safe to send through the same sanitiser as the AI text.
 */
export function buildFallbackCoverLetter(input: {
  profile: UserProfile;
  job: ScrapedJob;
  strongSkills: string[];
  summary: string;
}): string {
  const { summary, job, profile, strongSkills } = input;
  const positioning = compressToProse(summary || profile.summary || profile.headline || "");
  const highlighted = strongSkills.filter(Boolean).slice(0, 3);
  const recentRole = profile.experience[0];

  const opening = `I am writing to apply for the ${job.title} role at ${job.companyName}.`;
  const background = [
    positioning,
    recentRole ? `My most recent role was ${recentRole.title} at ${recentRole.company}.` : "",
    highlighted.length > 0
      ? `The strengths I would bring to this role include ${formatList(highlighted)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const closing = `I would welcome the chance to discuss how my background fits what your team needs. Thank you for your time and consideration.`;

  return [opening, background, closing].filter(Boolean).join("\n\n");
}

function formatList(values: string[]): string {
  if (values.length === 1) return values[0]!;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

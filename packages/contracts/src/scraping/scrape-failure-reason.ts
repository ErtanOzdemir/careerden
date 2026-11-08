import { z } from "zod";

/**
 * Why a job-site import did not produce a job posting. The categories are site-neutral so every
 * scraper adapter reports the same vocabulary, and the renderer can explain a failure and offer
 * the manual paste flow without knowing which site was involved.
 *
 * - `blocked`: the site refused guest access, for example LinkedIn's `999` or an auth wall.
 * - `rate_limited`: the site is throttling requests (`429`).
 * - `network`: the request never completed or the site answered with a server error.
 * - `parse`: the response did not have the page structure the adapter knows how to read.
 * - `empty_description`: the posting was found but carried no description text.
 * - `not_found`: the posting does not exist (anymore).
 * - `disabled`: import from this site is switched off, for example by a feature flag.
 * - `unknown`: anything that was not classified.
 */
export const scrapeFailureCategorySchema = z.enum([
  "blocked",
  "rate_limited",
  "network",
  "parse",
  "empty_description",
  "not_found",
  "disabled",
  "unknown",
]);

export type ScrapeFailureCategory = z.infer<typeof scrapeFailureCategorySchema>;

export interface ScrapeFailureReason {
  category: ScrapeFailureCategory;
  detail: string;
}

const reasonCodePrefix = "scrape_";

// Reason codes that predate the shared categories. `linkedin_rate_limited` is the throttling code
// proposed separately for the scrape retry backoff, and is read the same way so both compose.
const legacyReasonCodes: Record<string, ScrapeFailureCategory> = {
  linkedin_guest_company_unavailable: "blocked",
  linkedin_rate_limited: "rate_limited",
};

/**
 * The category travels inside the failure reason because scraping runs in an Electron utility
 * process and reaches the API as a message string. The same string is persisted as the job
 * application's `failureReason` and served to the renderer, so no schema has to change.
 */
export function formatScrapeFailureReason(category: ScrapeFailureCategory, detail: string): string {
  return `${reasonCodePrefix}${category}: ${detail}`;
}

export function parseScrapeFailureReason(
  reason: string | null | undefined,
): ScrapeFailureReason | undefined {
  const match = reason?.match(/^([a-z_]+): ([\s\S]*)$/);

  if (!match) {
    return undefined;
  }

  const [, code = "", detail = ""] = match;
  const category = code.startsWith(reasonCodePrefix)
    ? scrapeFailureCategorySchema.safeParse(code.slice(reasonCodePrefix.length)).data
    : legacyReasonCodes[code];

  return category ? { category, detail } : undefined;
}

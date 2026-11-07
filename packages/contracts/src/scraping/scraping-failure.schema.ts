import { z } from "zod";

/**
 * Why a job site import failed, independent of the site that produced it. Site adapters map their
 * own HTTP statuses and parser results onto these categories; everything above the adapter only
 * sees the category.
 */
export const scrapingFailureCategorySchema = z.enum([
  // The posting was removed or never existed (HTTP 404/410).
  "not_found",
  // The site refuses guest access right now (LinkedIn's 999, 401, 403, or a sign-in wall).
  "blocked",
  // Too many requests (HTTP 429).
  "rate_limited",
  // The page loaded, but the fields the parser expects were missing.
  "parse_failed",
  // No connection, DNS failure, or a timeout.
  "network",
  // Importing from this site is turned off.
  "disabled",
  // Any other response the adapter does not recognize, such as a 5xx.
  "unknown",
]);

export type ScrapingFailureCategory = z.infer<typeof scrapingFailureCategorySchema>;

export const scrapingFailureActionSchema = z.enum(["paste_text", "try_again"]);

export type ScrapingFailureAction = z.infer<typeof scrapingFailureActionSchema>;

export interface ScrapingFailureGuidance {
  /** The message shown to the user in place of the raw site response. */
  message: string;
  /** Recovery actions to offer, most useful first. */
  actions: readonly ScrapingFailureAction[];
}

export const scrapingFailureGuidance: Readonly<
  Record<ScrapingFailureCategory, ScrapingFailureGuidance>
> = {
  not_found: {
    message: "This posting is no longer live.",
    actions: ["paste_text"],
  },
  blocked: {
    message: "LinkedIn is limiting access right now. You can paste the job text manually.",
    actions: ["paste_text", "try_again"],
  },
  rate_limited: {
    message:
      "LinkedIn received too many requests. Try again in a few minutes or paste the text manually.",
    actions: ["try_again", "paste_text"],
  },
  parse_failed: {
    message: "LinkedIn's page structure may have changed. You can paste the text manually.",
    actions: ["paste_text"],
  },
  network: {
    message: "Check your internet connection.",
    actions: ["try_again"],
  },
  disabled: {
    message: "LinkedIn import is turned off. You can paste the job text manually.",
    actions: ["paste_text"],
  },
  unknown: {
    message: "LinkedIn returned an unexpected response. Try again or paste the text manually.",
    actions: ["try_again", "paste_text"],
  },
};

/** Returns the category when the value is a known one, so stale or foreign values degrade safely. */
export function parseScrapingFailureCategory(value: unknown): ScrapingFailureCategory | undefined {
  const parsed = scrapingFailureCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

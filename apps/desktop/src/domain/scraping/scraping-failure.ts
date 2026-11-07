import {
  parseScrapingFailureCategory,
  scrapingFailureGuidance,
  type ScrapingFailureCategory,
} from "@careerden/contracts";

/**
 * A scrape that failed for a known reason. Site adapters throw it after mapping their own
 * responses; callers only read the category and the user-facing message.
 */
export class ScrapingFailure extends Error {
  override readonly name = "ScrapingFailure";

  constructor(
    readonly category: ScrapingFailureCategory,
    /** Technical detail for logs, such as the HTTP status. Never shown to the user. */
    readonly detail?: string,
  ) {
    super(scrapingFailureGuidance[category].message);
  }
}

export function isScrapingFailure(error: unknown): error is ScrapingFailure {
  return error instanceof ScrapingFailure;
}

/** Categorizes any scrape error; errors that were not mapped by an adapter are `unknown`. */
export function toScrapingFailure(error: unknown): ScrapingFailure {
  if (isScrapingFailure(error)) {
    return error;
  }

  return new ScrapingFailure("unknown", error instanceof Error ? error.message : undefined);
}

export function restoreScrapingFailure(category: unknown, detail?: string): ScrapingFailure {
  return new ScrapingFailure(parseScrapingFailureCategory(category) ?? "unknown", detail);
}

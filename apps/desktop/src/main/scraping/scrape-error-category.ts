export type ScrapeErrorCategory =
  | "not_found"
  | "blocked"
  | "rate_limited"
  | "http_error"
  | "network"
  | "extraction";

// Groups a scrape failure for the log by its HTTP status or error type.
export function categorizeScrapeError(error: unknown): ScrapeErrorCategory {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCode === "number") {
    if (statusCode === 404 || statusCode === 410) return "not_found";
    if (statusCode === 429) return "rate_limited";
    if (statusCode === 401 || statusCode === 403 || statusCode === 999) return "blocked";
    return "http_error";
  }
  if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
    return "network";
  }
  return "extraction";
}

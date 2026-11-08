import { parseScrapeFailureReason, type ScrapeFailureCategory } from "@careerden/contracts";
import { openAddJobEventName } from "../onboarding/OnboardingGate.js";
import type { JobApplication } from "../types.js";

/** What the manual paste form starts with when LinkedIn import cannot be used. */
export interface ManualPastePrefill {
  companyName?: string;
  jobUrl: string;
  roleTitle?: string;
}

/** Optional detail of the open-add-job event. Without one the dialog opens as usual. */
export interface OpenAddJobRequest {
  method: "manual";
  prefill: ManualPastePrefill;
}

export interface LinkedInImportFailure {
  category: ScrapeFailureCategory;
  // The scrape will be tried again automatically; pasting is optional.
  retryScheduled: boolean;
}

/**
 * A LinkedIn import that has not produced a job description and has failed at least once. Any
 * failure qualifies, including reasons recorded before failures were categorized, so the paste
 * flow is always one click away.
 */
export function getLinkedInImportFailure(app: JobApplication): LinkedInImportFailure | undefined {
  if (!app.sourceUrl || app.description) return undefined;

  const category =
    parseScrapeFailureReason(app.processingFailureReason)?.category ??
    (app.processingFailureReason || app.processingStatus === "failed" ? "unknown" : undefined);

  if (app.processingStatus === "failed" && category) {
    return { category, retryScheduled: false };
  }

  if (app.processingStatus === "queued" && app.processingFailureReason && category) {
    return { category, retryScheduled: true };
  }

  return undefined;
}

const failureTitles: Record<ScrapeFailureCategory, string> = {
  blocked: "LinkedIn blocked the import",
  rate_limited: "LinkedIn is limiting requests right now",
  network: "LinkedIn could not be reached",
  parse: "LinkedIn changed how this posting is shown",
  empty_description: "LinkedIn did not share the job description",
  not_found: "LinkedIn could not find this posting",
  disabled: "LinkedIn import is turned off",
  unknown: "LinkedIn import did not work",
};

export function describeLinkedInImportFailure(category: ScrapeFailureCategory): string {
  return failureTitles[category];
}

/** The persisted failure reason without its category code, for display. */
export function scrapeFailureDetail(reason: string | undefined): string | undefined {
  return parseScrapeFailureReason(reason)?.detail ?? reason;
}

/**
 * Prefills the paste form from a LinkedIn job URL. Slugged URLs such as
 * `/jobs/view/senior-engineer-at-acme-4300011451` also yield a best-effort role and company,
 * which the user can still correct before saving.
 */
export function manualPastePrefillFromUrl(sourceUrl: string): ManualPastePrefill {
  const jobUrl = sourceUrl.trim();
  const slug = parseSlug(jobUrl);
  const separator = slug?.lastIndexOf("-at-") ?? -1;

  if (!slug || separator <= 0) return { jobUrl };

  const roleTitle = titleCase(slug.slice(0, separator));
  const companyName = titleCase(slug.slice(separator + "-at-".length));

  return {
    jobUrl,
    ...(roleTitle ? { roleTitle } : {}),
    ...(companyName ? { companyName } : {}),
  };
}

/** Opens the add-job dialog on the manual paste form, prefilled from the LinkedIn URL. */
export function openManualPasteFlow(sourceUrl: string): void {
  const detail: OpenAddJobRequest = {
    method: "manual",
    prefill: manualPastePrefillFromUrl(sourceUrl),
  };
  window.dispatchEvent(new CustomEvent(openAddJobEventName, { detail }));
}

export function readOpenAddJobRequest(event: Event): OpenAddJobRequest | undefined {
  const detail = event instanceof CustomEvent ? (event.detail as unknown) : undefined;

  if (
    typeof detail === "object" &&
    detail !== null &&
    (detail as OpenAddJobRequest).method === "manual" &&
    typeof (detail as OpenAddJobRequest).prefill?.jobUrl === "string"
  ) {
    return detail as OpenAddJobRequest;
  }

  return undefined;
}

function parseSlug(url: string): string | undefined {
  try {
    const match = new URL(url).pathname.match(/\/jobs\/view\/([a-z0-9-]+?)-\d{6,}\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function titleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

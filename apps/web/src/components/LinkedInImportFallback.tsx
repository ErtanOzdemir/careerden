import { ClipboardPaste, RefreshCw, TriangleAlert } from "lucide-react";
import {
  describeLinkedInImportFailure,
  scrapeFailureDetail,
  type LinkedInImportFailure,
} from "../lib/linkedin-import-fallback.js";
import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.js";

/**
 * Shown when a LinkedIn import produced no job description. The paste flow does not depend on
 * LinkedIn's HTML, so it is offered for every failure category, one click away.
 */
export function LinkedInImportFallback({
  failure,
  failureReason,
  isRetrying = false,
  onPaste,
  onRetry,
}: {
  failure: LinkedInImportFailure;
  failureReason?: string;
  isRetrying?: boolean;
  onPaste: () => void;
  onRetry?: () => void;
}) {
  const detail = scrapeFailureDetail(failureReason);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        failure.retryScheduled
          ? "border-warning/30 bg-warning-soft"
          : "border-destructive/20 bg-danger-soft",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <TriangleAlert
          className={cn(
            "mt-0.5 size-4 shrink-0",
            failure.retryScheduled ? "text-warning" : "text-destructive",
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {describeLinkedInImportFailure(failure.category)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {failure.retryScheduled
              ? "Careerden will try again automatically. You can also paste the job description now and keep going."
              : "You can still add this job. Paste the description from LinkedIn and Careerden keeps the link."}
          </p>
          {detail && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>
              {detail}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && !failure.retryScheduled && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        )}
        <Button size="sm" onClick={onPaste}>
          <ClipboardPaste className="size-3.5" />
          Paste the job description
        </Button>
      </div>
    </div>
  );
}

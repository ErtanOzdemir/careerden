import { ClipboardPaste, RefreshCw } from "lucide-react";
import { scrapingFailureGuidance, type ScrapingFailureCategory } from "@careerden/contracts";
import { Button } from "./ui/button.js";

interface ScrapeFailureNoticeProps {
  category: ScrapingFailureCategory;
  isRetrying?: boolean;
  onPasteText: () => void;
  onRetry: () => void;
  /** Archived applications are read-only, so they show the message without actions. */
  readOnly?: boolean;
}

/** Explains a failed LinkedIn import and offers the recovery actions that fit its cause. */
export function ScrapeFailureNotice({
  category,
  isRetrying,
  onPasteText,
  onRetry,
  readOnly,
}: ScrapeFailureNoticeProps) {
  const guidance = scrapingFailureGuidance[category];

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-destructive">{guidance.message}</p>
      {!readOnly && (
        <div className="flex shrink-0 gap-2">
          {guidance.actions.map((action, index) =>
            action === "paste_text" ? (
              <Button
                key={action}
                variant={index === 0 ? "default" : "outline"}
                size="sm"
                onClick={onPasteText}
              >
                <ClipboardPaste className="size-3.5" />
                Paste text
              </Button>
            ) : (
              <Button
                key={action}
                variant={index === 0 ? "default" : "outline"}
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
              >
                <RefreshCw className="size-3.5" />
                {isRetrying ? "Trying again..." : "Try again"}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

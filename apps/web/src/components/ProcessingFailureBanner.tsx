import { Link } from "react-router-dom";
import { RefreshCw, Settings } from "lucide-react";
import type { AiProviderFailureDto } from "@careerden/contracts";
import { Button, buttonVariants } from "./ui/button.js";
import { describeAiFailure } from "../lib/ai-failure-notice.js";
import { isLocalEdition } from "../edition.js";
import { aiProviderPath } from "../settings/AiProviderSettings.js";

interface ProcessingFailureBannerProps {
  reason?: string;
  aiFailure?: AiProviderFailureDto;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  // Test seam; defaults to the build's edition.
  local?: boolean;
}

// Explains why processing failed. AI provider failures get a plain-language message and, when
// the fix is a new key, provider, or model, a way to the AI provider settings.
export function ProcessingFailureBanner({
  reason,
  aiFailure,
  canRetry,
  isRetrying,
  onRetry,
  local = isLocalEdition,
}: ProcessingFailureBannerProps) {
  const notice = aiFailure ? describeAiFailure(aiFailure, local) : undefined;
  const showSettings = Boolean(notice?.showSettings && local);

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      {notice ? (
        <div>
          <p className="text-sm font-medium text-destructive">{notice.title}</p>
          <p className="mt-0.5 text-sm text-foreground">{notice.message}</p>
        </div>
      ) : (
        <p className="text-sm text-destructive">{reason ?? "Processing failed"}</p>
      )}
      {(showSettings || canRetry) && (
        <div className="flex shrink-0 gap-2">
          {showSettings && (
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              to={aiProviderPath}
            >
              <Settings className="size-3.5" />
              Go to Settings
            </Link>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
              <RefreshCw className="size-3.5" />
              {notice ? "Try again" : "Retry"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

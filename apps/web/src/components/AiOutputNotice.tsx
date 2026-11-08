import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils.js";

export const aiOutputNoticeText =
  "This document was generated with AI. Check every line before sending it.";

/** Shown wherever a generated document is previewed or downloaded. */
export function AiOutputNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 border-warning/20 bg-warning-soft/60 text-xs text-foreground",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning-emphasis" />
      <span>{aiOutputNoticeText}</span>
    </p>
  );
}

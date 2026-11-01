import { useEffect } from "react";
import { Button } from "../ui/button.js";

export const undoToastDurationMs = 8000;

// A short-lived notice with an Undo action, for changes that are easy to make by mistake.
export function UndoToast({
  message,
  busy = false,
  onUndo,
  onDismiss,
}: {
  message: string;
  busy?: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (busy) return;
    const timeout = setTimeout(onDismiss, undoToastDurationMs);
    return () => clearTimeout(timeout);
  }, [busy, message, onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-popover py-2 pr-2 pl-4 text-sm text-popover-foreground shadow-lg"
    >
      <span>{message}</span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onUndo}>
        Undo
      </Button>
      <Button variant="ghost" size="sm" aria-label="Dismiss" disabled={busy} onClick={onDismiss}>
        ×
      </Button>
    </div>
  );
}

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "./button.js";
import { cn } from "../../lib/utils.js";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  error,
  isPending = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  description: ReactNode;
  error?: string | null;
  isPending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog.Root
      disablePointerDismissal={isPending}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-foreground shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </Dialog.Description>
            {error && (
              <p className="mt-3 rounded-lg border border-destructive/20 bg-danger-soft p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close
                className={cn(buttonVariants({ variant: "outline" }))}
                disabled={isPending}
              >
                {cancelLabel}
              </Dialog.Close>
              <Button disabled={isPending} onClick={onConfirm} variant="destructive">
                {isPending ? "Deleting..." : confirmLabel}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

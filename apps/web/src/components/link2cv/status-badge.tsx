import { cn } from "../../lib/utils.js";

export type DisplayStatus =
  | "saved"
  | "processing"
  | "ready"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";

export type DisplayPriority = "low" | "medium" | "high";

const statusLabels: Record<DisplayStatus, string> = {
  saved: "Saved",
  processing: "Processing",
  ready: "Ready to apply",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

const priorityLabels: Record<DisplayPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const statusStyles: Record<DisplayStatus, string> = {
  saved: "bg-muted text-muted-foreground",
  processing: "bg-info-soft text-info",
  ready: "bg-accent text-accent-foreground",
  applied: "bg-info-soft text-info",
  interview: "bg-warning-soft text-warning-foreground",
  offer: "bg-success-soft text-success",
  rejected: "bg-muted text-muted-foreground",
};

const statusDot: Record<DisplayStatus, string> = {
  saved: "bg-muted-foreground/50",
  processing: "bg-info",
  ready: "bg-primary",
  applied: "bg-info",
  interview: "bg-warning",
  offer: "bg-success",
  rejected: "bg-muted-foreground/50",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          statusDot[status],
          status === "processing" && "animate-pulse",
        )}
      />
      {statusLabels[status]}
    </span>
  );
}

const priorityStyles: Record<DisplayPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-warning-foreground",
};

export function PriorityTag({ priority }: { priority: DisplayPriority }) {
  return (
    <span className={cn("text-xs font-medium", priorityStyles[priority])}>
      {priorityLabels[priority]}
    </span>
  );
}

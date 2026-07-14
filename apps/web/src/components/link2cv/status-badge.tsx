import { cn } from "../../lib/utils.js";

export type DisplayStatus =
  | "saved"
  | "processing"
  | "ready"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted";

export type DisplayInterestLevel = "low" | "medium" | "high";

const statusLabels: Record<DisplayStatus, string> = {
  saved: "Saved",
  processing: "Processing",
  ready: "Ready to apply",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

const interestLabels: Record<DisplayInterestLevel, string> = {
  low: "🤔 Low interest",
  medium: "👀 Interested",
  high: "🔥 Highly interested",
};

const statusStyles: Record<DisplayStatus, string> = {
  saved: "bg-muted text-muted-foreground",
  processing: "bg-info-soft text-info",
  ready: "bg-accent text-accent-foreground",
  applied: "bg-info-soft text-info",
  interview: "bg-warning-soft text-warning-emphasis",
  offer: "bg-success-soft text-success",
  rejected: "bg-muted text-muted-foreground",
  ghosted: "bg-muted text-muted-foreground",
};

const statusDot: Record<DisplayStatus, string> = {
  saved: "bg-muted-foreground/50",
  processing: "bg-info",
  ready: "bg-primary",
  applied: "bg-info",
  interview: "bg-warning",
  offer: "bg-success",
  rejected: "bg-muted-foreground/50",
  ghosted: "bg-muted-foreground/50",
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

const interestStyles: Record<DisplayInterestLevel, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-warning-emphasis",
};

export function InterestTag({ interestLevel }: { interestLevel?: DisplayInterestLevel }) {
  if (!interestLevel) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <span className={cn("whitespace-nowrap text-xs font-medium", interestStyles[interestLevel])}>
      {interestLabels[interestLevel]}
    </span>
  );
}

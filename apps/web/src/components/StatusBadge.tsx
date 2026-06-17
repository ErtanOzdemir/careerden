import type { ApplicationStatus } from "../types";

const statusStyles: Record<ApplicationStatus, string> = {
  Applied: "bg-secondary-container text-on-secondary-container",
  Interviewing: "bg-primary-container/10 text-primary",
  Offer: "bg-secondary-fixed text-on-secondary-fixed-variant",
  Rejected: "bg-error-container text-on-error-container",
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`px-3 py-1 rounded-full text-label-sm font-bold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

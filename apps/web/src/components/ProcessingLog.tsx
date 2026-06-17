import type { ProcessingLogItem } from "../types";

interface ProcessingLogProps {
  currentStatus?: string;
  failureReason?: string;
  items: ProcessingLogItem[];
}

export default function ProcessingLog({ currentStatus, failureReason, items }: ProcessingLogProps) {
  return (
    <div className="space-y-md">
      {currentStatus && (
        <div className="flex items-center justify-between gap-md rounded-lg bg-surface-container-low px-md py-sm border border-outline-variant">
          <div>
            <div className="font-label-md uppercase text-secondary">Current state</div>
            <div className="font-body-md font-bold text-on-surface">{currentStatus}</div>
          </div>
          <span className="material-symbols-outlined text-primary">sync</span>
        </div>
      )}

      {failureReason && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-md py-sm text-body-md text-error">
          {failureReason}
        </div>
      )}

      {items.length > 0 ? (
        <div className="relative pl-8 space-y-md">
          <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-outline-variant" />
          {items.map((item) => (
            <div key={item.id} className="relative">
              <div
                className={`absolute -left-[28px] top-1 w-6 h-6 rounded-full border-4 border-surface-container-lowest flex items-center justify-center ${
                  item.status === "failed" ? "bg-error" : "bg-primary"
                }`}
              >
                <span className="material-symbols-outlined text-on-primary text-[14px]">
                  {item.status === "failed" ? "error" : "check"}
                </span>
              </div>
              <div
                className={`font-label-md uppercase ${
                  item.status === "failed" ? "text-error" : "text-secondary"
                }`}
              >
                {item.status === "failed" ? "Failed" : "Logged"} &bull; {item.date}
              </div>
              <div className="font-body-md font-bold">{item.title}</div>
              <div className="font-body-md text-on-surface-variant">{item.description}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 p-md text-body-md text-secondary">
          No processing logs yet.
        </div>
      )}
    </div>
  );
}

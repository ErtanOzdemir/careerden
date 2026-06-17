import type { TimelineMilestone } from "../types";

interface TimelineProps {
  milestones: TimelineMilestone[];
}

export default function Timeline({ milestones }: TimelineProps) {
  return (
    <div className="relative pl-8 space-y-lg">
      <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-outline-variant" />
      {milestones.map((m) => (
        <div key={m.id} className="relative">
          <div
            className={`absolute -left-[28px] top-1 w-6 h-6 rounded-full border-4 border-surface-container-lowest flex items-center justify-center ${
              m.status === "completed"
                ? "bg-primary"
                : "bg-surface-container-high border-2 border-dashed border-outline-variant"
            }`}
          >
            {m.status === "completed" ? (
              <span className="material-symbols-outlined text-on-primary text-[14px]">
                check
              </span>
            ) : (
              <span className="material-symbols-outlined text-outline-variant text-[14px]">
                circle
              </span>
            )}
          </div>
          <div
            className={`font-label-md uppercase ${
              m.status === "completed"
                ? "text-secondary"
                : "text-primary"
            }`}
          >
            {m.status === "completed" ? "Completed" : "Upcoming"} &bull;{" "}
            {m.date}
          </div>
          <div className="font-body-md font-bold">{m.title}</div>
          <div className="font-body-md text-on-surface-variant">
            {m.description}
          </div>
        </div>
      ))}
      <div className="relative group">
        <div className="absolute -left-[28px] top-1 w-6 h-6 rounded-full bg-surface-container-high border-2 border-dashed border-outline-variant flex items-center justify-center">
          <span className="material-symbols-outlined text-outline-variant text-[14px]">
            add
          </span>
        </div>
        <div className="p-md border border-dashed border-outline-variant rounded-lg bg-surface-container-low/50 group-hover:bg-surface-container-low transition-colors">
          <div className="grid grid-cols-2 gap-md">
            <input
              className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
              placeholder="Title (e.g. Design Challenge)"
              type="text"
            />
            <input
              className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
              type="date"
            />
            <select className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none">
              <option>Interview Type</option>
              <option>Technical</option>
              <option>Behavioral</option>
              <option>On-site</option>
            </select>
            <div className="flex gap-2">
              <button className="flex-1 text-label-md bg-primary text-on-primary rounded py-1 cursor-pointer">
                Save
              </button>
              <button className="px-3 text-label-md bg-surface-variant rounded py-1 cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import type { TimelineMilestone } from "../types";

export interface TimelineInterviewInput {
  scheduledAt: string;
  title: string;
  type?: string;
}

interface TimelineProps {
  isAdding?: boolean;
  milestones: TimelineMilestone[];
  onAddInterview?: (input: TimelineInterviewInput) => Promise<void>;
}

export default function Timeline({ isAdding = false, milestones, onAddInterview }: TimelineProps) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [type, setType] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onAddInterview || !title.trim() || !scheduledAt) {
      return;
    }

    await onAddInterview({
      scheduledAt,
      title: title.trim(),
      type: type || undefined,
    });

    setTitle("");
    setScheduledAt("");
    setType("");
  }

  return (
    <div className="relative pl-8 space-y-lg">
      <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-outline-variant" />
      {milestones.map((m) => (
        <div key={m.id} className="relative">
          <div
            className={`absolute -left-[28px] top-1 w-6 h-6 rounded-full border-4 border-surface-container-lowest flex items-center justify-center ${
              m.status === "completed"
                ? "bg-primary"
                : m.status === "cancelled"
                  ? "bg-error"
                  : "bg-surface-container-high border-2 border-dashed border-outline-variant"
            }`}
          >
            {m.status === "completed" ? (
              <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
            ) : m.status === "cancelled" ? (
              <span className="material-symbols-outlined text-on-primary text-[14px]">close</span>
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
                : m.status === "cancelled"
                  ? "text-error"
                  : "text-primary"
            }`}
          >
            {m.status === "completed"
              ? "Completed"
              : m.status === "cancelled"
                ? "Cancelled"
                : "Upcoming"}{" "}
            &bull; {m.date}
          </div>
          <div className="font-body-md font-bold">{m.title}</div>
          <div className="font-body-md text-on-surface-variant">{m.description}</div>
        </div>
      ))}
      <div className="relative group">
        <div className="absolute -left-[28px] top-1 w-6 h-6 rounded-full bg-surface-container-high border-2 border-dashed border-outline-variant flex items-center justify-center">
          <span className="material-symbols-outlined text-outline-variant text-[14px]">add</span>
        </div>
        <div className="p-md border border-dashed border-outline-variant rounded-lg bg-surface-container-low/50 group-hover:bg-surface-container-low transition-colors">
          <form className="grid grid-cols-2 gap-md" onSubmit={(event) => void handleSubmit(event)}>
            <input
              className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
              placeholder="Title (e.g. Design Challenge)"
              required
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
              required
              type="date"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <select
              className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">Interview Type</option>
              <option value="Technical">Technical</option>
              <option value="Behavioral">Behavioral</option>
              <option value="On-site">On-site</option>
            </select>
            <div className="flex gap-2">
              <button
                className="flex-1 text-label-md bg-primary text-on-primary rounded py-1 cursor-pointer disabled:opacity-60"
                disabled={isAdding || !onAddInterview}
                type="submit"
              >
                {isAdding ? "Saving..." : "Save"}
              </button>
              <button
                className="px-3 text-label-md bg-surface-variant rounded py-1 cursor-pointer"
                onClick={() => {
                  setTitle("");
                  setScheduledAt("");
                  setType("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

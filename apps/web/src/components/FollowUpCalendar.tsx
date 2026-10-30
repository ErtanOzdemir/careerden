import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button.js";
import { cn } from "../lib/utils.js";

export interface CalendarFollowUp {
  id: string;
  jobApplicationId: string;
  title: string;
  company: string;
  scheduledAt: Date;
}

// Weeks start on Monday.
const weekdayOffsets = [0, 1, 2, 3, 4, 5, 6];

/**
 * A month calendar that marks days with follow-ups and lists the selected day's follow-ups below
 * it. Days are compared in the viewer's local time zone.
 */
export function FollowUpCalendar({
  followUps,
  onOpen,
  today = new Date(),
}: {
  followUps: CalendarFollowUp[];
  onOpen: (jobApplicationId: string) => void;
  today?: Date;
}) {
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(today));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));

  const followUpsByDay = useMemo(() => {
    const byDay = new Map<string, CalendarFollowUp[]>();
    for (const followUp of followUps) {
      const key = dayKey(followUp.scheduledAt);
      byDay.set(key, [...(byDay.get(key) ?? []), followUp]);
    }
    for (const dayFollowUps of byDay.values()) {
      dayFollowUps.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
    }
    return byDay;
  }, [followUps]);

  const days = calendarDays(visibleMonth);
  const selectedFollowUps = followUpsByDay.get(dayKey(selectedDay)) ?? [];
  const weekdayLabels = weekdayOffsets.map((offset) =>
    // 2024-01-01 was a Monday.
    new Date(2024, 0, 1 + offset).toLocaleDateString(undefined, { weekday: "narrow" }),
  );

  function showMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div>
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between pb-2">
          <Button
            aria-label="Previous month"
            onClick={() => showMonth(-1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronLeft />
          </Button>
          <p aria-live="polite" className="text-sm font-medium text-foreground">
            {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <Button
            aria-label="Next month"
            onClick={() => showMonth(1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {weekdayLabels.map((label, index) => (
            <div className="pb-1 text-[0.7rem] font-medium text-muted-foreground" key={index}>
              {label}
            </div>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const count = followUpsByDay.get(key)?.length ?? 0;
            const isSelected = key === dayKey(selectedDay);
            const isToday = key === dayKey(today);
            const isOutsideMonth = day.getMonth() !== visibleMonth.getMonth();
            return (
              <div className="flex justify-center py-0.5" key={key}>
                <button
                  aria-label={`${day.toLocaleDateString(undefined, {
                    dateStyle: "full",
                  })}${count > 0 ? `, ${count} follow-up${count === 1 ? "" : "s"}` : ""}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative flex size-9 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-muted",
                    !isSelected && isToday && "font-semibold text-primary ring-1 ring-primary/40",
                    !isSelected &&
                      !isToday &&
                      (isOutsideMonth ? "text-muted-foreground/50" : "text-foreground"),
                  )}
                  onClick={() => {
                    setSelectedDay(day);
                    if (isOutsideMonth) setVisibleMonth(startOfMonth(day));
                  }}
                  type="button"
                >
                  {day.getDate()}
                  {count > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1 size-1 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-primary",
                      )}
                      data-testid="follow-up-dot"
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border">
        <p className="px-5 pt-3 pb-1 text-xs font-medium text-muted-foreground">
          {selectedDay.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        {selectedFollowUps.length > 0 ? (
          <ul className="divide-y divide-border">
            {selectedFollowUps.map((followUp) => (
              <li key={followUp.id}>
                <button
                  className="flex w-full gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => onOpen(followUp.jobApplicationId)}
                  type="button"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <CalendarDays className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{followUp.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{followUp.company}</p>
                    <p className="mt-1 text-xs font-medium text-primary">
                      {followUp.scheduledAt.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pt-1 pb-5 text-sm text-muted-foreground">No follow-ups on this day.</p>
        )}
      </div>
    </div>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// The full weeks covering the month, from the Monday on or before the 1st to the Sunday on or
// after its last day.
function calendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  const trailing = 6 - ((last.getDay() + 6) % 7);
  const total = leading + last.getDate() + trailing;
  return Array.from(
    { length: total },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - leading + index),
  );
}

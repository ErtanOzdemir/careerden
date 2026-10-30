import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowUpCalendar, type CalendarFollowUp } from "./FollowUpCalendar.js";

const today = new Date(2026, 9, 30, 9, 0);

const followUps: CalendarFollowUp[] = [
  {
    id: "later",
    jobApplicationId: "job-1",
    title: "Second check-in",
    company: "Acme",
    scheduledAt: new Date(2026, 9, 30, 16, 0),
  },
  {
    id: "earlier",
    jobApplicationId: "job-2",
    title: "Send thank-you note",
    company: "Globex",
    scheduledAt: new Date(2026, 9, 30, 10, 0),
  },
  {
    id: "next-month",
    jobApplicationId: "job-3",
    title: "Ask about offer",
    company: "Initech",
    scheduledAt: new Date(2026, 10, 1, 11, 0),
  },
];

function dayButton(day: Date) {
  return screen.getByRole("button", {
    name: new RegExp(`^${day.toLocaleDateString(undefined, { dateStyle: "full" })}`),
  });
}

describe("FollowUpCalendar", () => {
  afterEach(cleanup);

  it("marks days with follow-ups and lists today's follow-ups in time order", () => {
    render(<FollowUpCalendar followUps={followUps} onOpen={vi.fn()} today={today} />);

    expect(
      screen.getByText(today.toLocaleDateString(undefined, { month: "long", year: "numeric" })),
    ).toBeInTheDocument();
    expect(dayButton(today)).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(today)).toHaveAccessibleName(expect.stringContaining("2 follow-ups"));
    expect(within(dayButton(today)).getByTestId("follow-up-dot")).toBeInTheDocument();
    // November 1 shows in the trailing week of October's grid.
    expect(
      within(dayButton(new Date(2026, 10, 1))).getByTestId("follow-up-dot"),
    ).toBeInTheDocument();
    expect(within(dayButton(new Date(2026, 9, 29))).queryByTestId("follow-up-dot")).toBeNull();

    const titles = screen.getAllByText(/Send thank-you note|Second check-in/);
    expect(titles.map((title) => title.textContent)).toEqual([
      "Send thank-you note",
      "Second check-in",
    ]);
  });

  it("selects another day, switches months, and opens a follow-up's application", () => {
    const onOpen = vi.fn();
    render(<FollowUpCalendar followUps={followUps} onOpen={onOpen} today={today} />);

    fireEvent.click(dayButton(new Date(2026, 9, 29)));
    expect(screen.getByText("No follow-ups on this day.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByText(
        new Date(2026, 10, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      ),
    ).toBeInTheDocument();

    fireEvent.click(dayButton(new Date(2026, 10, 1)));
    fireEvent.click(screen.getByRole("button", { name: /Ask about offer/ }));
    expect(onOpen).toHaveBeenCalledWith("job-3");
  });
});

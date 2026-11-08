import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportIssuePanel, bugReportUrl } from "./ReportIssuePanel";

describe("ReportIssuePanel", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
  });

  it("links to the GitHub bug report form", () => {
    render(<ReportIssuePanel />);

    const link = screen.getByRole("link", { name: "Report an issue" });
    expect(bugReportUrl).toBe(
      "https://github.com/ErtanOzdemir/careerden/issues/new?template=bug_report.yml",
    );
    expect(link).toHaveAttribute("href", bugReportUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens the form in the system browser from the desktop app", () => {
    const openExternal = vi.fn(async () => undefined);
    window.electronAPI = { openExternal } as Window["electronAPI"];
    render(<ReportIssuePanel />);

    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Report an issue" }));

    expect(notPrevented).toBe(false);
    expect(openExternal).toHaveBeenCalledWith(bugReportUrl);
  });
});

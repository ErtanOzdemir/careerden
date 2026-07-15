import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "../types.js";
import { FollowUpsEmptyState, JobDetailsPanel } from "./AppDetail.js";

describe("FollowUpsEmptyState", () => {
  afterEach(cleanup);

  it("describes reminders and starts the add flow", () => {
    const onAdd = vi.fn();

    render(<FollowUpsEmptyState onAdd={onAdd} />);

    expect(screen.getByText("No follow-ups scheduled")).toBeInTheDocument();
    expect(screen.getByText(/remind you 10 minutes before/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schedule your first follow-up" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("JobDetailsPanel", () => {
  afterEach(cleanup);

  it("shows independent salary and interest rows", () => {
    renderPanel();

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Company website")).toBeInTheDocument();
    expect(screen.getByText("Work style")).toBeInTheDocument();
    expect(screen.getByText("Interest level")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Edit salary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit work style" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit interest level" })).toBeInTheDocument();
  });

  it("links to the company website in a new tab", () => {
    renderPanel();

    const companyWebsite = screen.getByRole("link", {
      name: "https://www.acme.example/careers",
    });
    expect(companyWebsite).toHaveAttribute("href", "https://www.acme.example/careers");
    expect(companyWebsite).toHaveAttribute("target", "_blank");
    expect(companyWebsite).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens and cancels the interest editor without changing the value", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    expect(screen.getByPlaceholderText("Select interest level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit salary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByText("Not set")).toHaveLength(3);
  });

  it("saves a selected interest level", async () => {
    const onSaveInterest = vi.fn(async () => undefined);
    renderPanel({ onSaveInterest });

    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    fireEvent.click(screen.getByRole("button", { name: "Open interest level options" }));
    fireEvent.click(await screen.findByText("Highly interested"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveInterest).toHaveBeenCalledWith("high"));
  });

  it("clears an existing interest level by selecting Not set", async () => {
    const onSaveInterest = vi.fn(async () => undefined);
    renderPanel({
      app: { ...createApplication(), interestLevel: "medium" },
      onSaveInterest,
    });

    expect(screen.getByText("👀 Interested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    fireEvent.click(screen.getByRole("button", { name: "Open interest level options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Not set" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveInterest).toHaveBeenCalledWith(null));
  });

  it("updates salary as gross or net", async () => {
    const onSaveSalary = vi.fn(async () => undefined);
    renderPanel({
      app: {
        ...createApplication(),
        salaryMinAmount: 90_000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "gross",
      },
      onSaveSalary,
    });

    expect(screen.getByText("90,000 EUR / year · Gross")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit salary" }));
    fireEvent.click(screen.getByRole("button", { name: "Open salary type options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Net" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSaveSalary).toHaveBeenCalledWith({
        salaryMinAmount: 90_000,
        salaryMaxAmount: null,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "net",
      }),
    );
  });

  it("updates and clears work style", async () => {
    const onSaveWorkStyle = vi.fn(async () => undefined);
    renderPanel({
      app: { ...createApplication(), workStyle: "remote" },
      onSaveWorkStyle,
    });

    expect(screen.getByText("Remote")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit work style" }));
    fireEvent.click(screen.getByRole("button", { name: "Open work style options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Hybrid" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveWorkStyle).toHaveBeenCalledWith("hybrid"));

    fireEvent.click(screen.getByRole("button", { name: "Edit work style" }));
    fireEvent.click(screen.getByRole("button", { name: "Open work style options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Not set" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveWorkStyle).toHaveBeenCalledWith(null));
  });
});

function renderPanel({
  app = createApplication(),
  onSaveInterest = vi.fn(async () => undefined),
  onSaveSalary = vi.fn(async () => undefined),
  onSaveWorkStyle = vi.fn(async () => undefined),
}: {
  app?: JobApplication;
  onSaveInterest?: (interestLevel: "high" | "low" | "medium" | null) => Promise<void>;
  onSaveSalary?: (input: {
    salaryCurrency: string | null;
    salaryMaxAmount: number | null;
    salaryMinAmount: number | null;
    salaryPeriod: "hourly" | "monthly" | "yearly" | null;
    salaryType: "gross" | "net" | null;
  }) => Promise<void>;
  onSaveWorkStyle?: (workStyle: "hybrid" | "on_site" | "remote" | null) => Promise<void>;
} = {}) {
  return render(
    <JobDetailsPanel
      app={app}
      isSavingInterest={false}
      isSavingSalary={false}
      isSavingWorkStyle={false}
      onSaveInterest={onSaveInterest}
      onSaveSalary={onSaveSalary}
      onSaveWorkStyle={onSaveWorkStyle}
    />,
  );
}

function createApplication(): JobApplication {
  return {
    id: "job-1",
    company: "Acme",
    companyWebsiteUrl: "https://www.acme.example/careers",
    domain: "linkedin.com",
    role: "Engineer",
    location: "Remote",
    dateApplied: "Jul 12, 2026",
    dateLabel: "Today",
    status: "Saved",
    tags: [],
  };
}

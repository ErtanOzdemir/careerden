import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplication } from "../types.js";
import { JobDetailsPanel } from "./AppDetail.js";

describe("JobDetailsPanel", () => {
  afterEach(cleanup);

  it("shows independent salary and interest rows", () => {
    renderPanel();

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Interest level")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Edit salary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit interest level" })).toBeInTheDocument();
  });

  it("opens and cancels the interest editor without changing the value", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    expect(screen.getByPlaceholderText("Select interest level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit salary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByText("Not set")).toHaveLength(2);
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
});

function renderPanel({
  app = createApplication(),
  onSaveInterest = vi.fn(async () => undefined),
  onSaveSalary = vi.fn(async () => undefined),
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
} = {}) {
  return render(
    <JobDetailsPanel
      app={app}
      isSavingInterest={false}
      isSavingSalary={false}
      onSaveInterest={onSaveInterest}
      onSaveSalary={onSaveSalary}
    />,
  );
}

function createApplication(): JobApplication {
  return {
    id: "job-1",
    company: "Acme",
    domain: "linkedin.com",
    role: "Engineer",
    location: "Remote",
    dateApplied: "Jul 12, 2026",
    dateLabel: "Today",
    status: "Saved",
    tags: [],
  };
}

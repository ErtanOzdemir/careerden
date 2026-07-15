import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplicationsLog from "./ApplicationsLog.js";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  me: vi.fn(),
}));

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    delete: vi.fn(),
    list: mocks.list,
  },
}));

vi.mock("../api/profiles.js", () => ({
  profilesApi: { me: mocks.me },
}));

vi.mock("../api/jobApplicationChanges.js", () => ({
  useJobApplicationChanges: vi.fn(),
}));

describe("ApplicationsLog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads URL-synced pagination, filters, search, and sorting from the server", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 20,
      totalItems: 25,
      totalPages: 2,
    });

    render(
      <MemoryRouter initialEntries={["/applications?q=acme&status=processing&sort=match&page=2"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsLog />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith({
        profileId: "profile-1",
        applicationStatus: undefined,
        processingStatuses: "queued,scraping,analyzing,generating_documents",
        search: "acme",
        page: 2,
        pageSize: 20,
        sortBy: "matchScore",
        sortDirection: "desc",
      }),
    );
    expect(screen.getByText("Showing 21-25 of 25 applications")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
  });

  it("places company logos on a light tile and falls back to company initials", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue({
      items: [
        {
          companyLogoUrl: "https://example.com/acme-logo.svg",
          createdAt: "2026-07-13T09:00:00.000Z",
          id: "application-1",
          profileId: "profile-1",
          status: "review_ready",
          tracking: {
            applicationStatus: "saved",
            companyName: "Acme",
            metadata: {},
            roleTitle: "Software Engineer",
            salaryCurrency: "EUR",
            salaryMaxAmount: 120_000,
            salaryMinAmount: 90_000,
            salaryPeriod: "yearly",
            salaryType: "gross",
            tags: [],
          },
          updatedAt: "2026-07-13T09:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsLog />} />
        </Routes>
      </MemoryRouter>,
    );

    const logo = await screen.findByRole("img", { name: "Acme logo" });
    expect(logo.parentElement).toHaveClass("bg-white", "border-black/10");
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Follow-up")).not.toBeInTheDocument();
    expect(screen.getByText("90,000 – 120,000 EUR / year · Gross")).toBeInTheDocument();

    fireEvent.error(logo);

    expect(await screen.findByText("AC")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Acme logo" })).not.toBeInTheDocument();
  });
});

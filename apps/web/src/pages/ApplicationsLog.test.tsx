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
});

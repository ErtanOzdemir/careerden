import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApplicationsLog from "./ApplicationsLog.js";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  delete: vi.fn(),
  me: vi.fn(),
  refreshBalance: vi.fn(),
  useJobApplicationChanges: vi.fn(),
}));

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    archive: mocks.archive,
    delete: mocks.delete,
    list: mocks.list,
    restore: mocks.restore,
  },
}));

vi.mock("../api/profiles.js", () => ({
  profilesApi: { me: mocks.me },
}));

vi.mock("../api/jobApplicationChanges.js", () => ({
  useJobApplicationChanges: mocks.useJobApplicationChanges,
}));

vi.mock("../billing/CreditBalanceProvider.js", () => ({
  useCreditBalance: () => ({ refreshBalance: mocks.refreshBalance }),
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
        archiveState: "active",
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

  it("refreshes credits when an application SSE change settles background work", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsLog />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.useJobApplicationChanges).toHaveBeenCalled());
    const handlers = mocks.useJobApplicationChanges.mock.calls.at(-1)?.[1] as {
      onChange: (change: {
        type: "application.changed";
        applicationId: string;
        profileId: string;
        occurredAt: string;
      }) => Promise<void>;
    };

    await act(async () => {
      await handlers.onChange({
        type: "application.changed",
        applicationId: "application-1",
        profileId: "profile-1",
        occurredAt: "2026-07-24T00:00:00.000Z",
      });
    });

    expect(mocks.refreshBalance).toHaveBeenCalledOnce();
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
    const applicationRow = screen.getByRole("link", {
      name: "Software Engineer at Acme",
    });
    expect(applicationRow.tagName).toBe("DIV");
    expect(within(applicationRow).getByRole("button", { name: "Actions" })).toBeInTheDocument();

    fireEvent.error(logo);

    expect(await screen.findByText("AC", undefined, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Acme logo" })).not.toBeInTheDocument();
  });

  it("permanently deletes an active application after confirmation", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.delete.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue(applicationPage("application-1", "Active role", 1));

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsLog />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Active role")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const deleteAction = screen.getByRole("button", { name: "Delete" });
    expect(deleteAction.parentElement?.parentElement?.closest(".overflow-hidden")).toBeNull();
    fireEvent.click(deleteAction);
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Delete permanently",
      }),
    );

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("application-1"));
  });

  it("replaces stale rows with the loading state while changing pages", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    let resolveSecondPage: ((value: ReturnType<typeof applicationPage>) => void) | undefined;
    mocks.list
      .mockResolvedValueOnce(applicationPage("application-1", "First page role", 1))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondPage = resolve;
          }),
      );

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsLog />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("First page role")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Loading applications...")).toBeInTheDocument();
    expect(screen.queryByText("First page role")).not.toBeInTheDocument();

    resolveSecondPage?.(applicationPage("application-2", "Second page role", 2));
    expect(await screen.findByText("Second page role")).toBeInTheDocument();
    expect(screen.queryByText("Loading applications...")).not.toBeInTheDocument();
  });

  it("loads the dedicated archive and restores an application", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.restore.mockResolvedValue({});
    mocks.list
      .mockResolvedValueOnce({
        ...applicationPage("application-1", "Archived role", 1),
        items: [
          {
            ...applicationPage("application-1", "Archived role", 1).items[0],
            archivedAt: "2026-07-31T12:00:00.000Z",
          },
        ],
        totalItems: 1,
        totalPages: 1,
      })
      .mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });

    render(
      <MemoryRouter initialEntries={["/applications/archived"]}>
        <Routes>
          <Route path="/applications/archived" element={<ApplicationsLog archiveMode />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Archived role")).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ archiveState: "archived", sortBy: "archivedAt" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith("application-1"));
  });
});

function applicationPage(id: string, roleTitle: string, page: number) {
  return {
    items: [
      {
        createdAt: "2026-07-13T09:00:00.000Z",
        id,
        profileId: "profile-1",
        status: "review_ready" as const,
        tracking: {
          applicationStatus: "saved" as const,
          companyName: "Acme",
          metadata: {},
          roleTitle,
          tags: [],
        },
        updatedAt: "2026-07-13T09:00:00.000Z",
      },
    ],
    page,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2,
  };
}

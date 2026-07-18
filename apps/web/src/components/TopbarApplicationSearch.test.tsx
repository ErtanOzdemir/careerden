import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState } from "react";
import type { ApiJobApplication, ApiJobApplicationsPage } from "../api/types.js";
import { TopbarApplicationSearch } from "./TopbarApplicationSearch.js";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  me: vi.fn(),
}));

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: { list: mocks.list },
}));

vi.mock("../api/profiles.js", () => ({
  profilesApi: { me: mocks.me },
}));

describe("TopbarApplicationSearch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("debounces profile-scoped searches and renders compact application results", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue(applicationPage([application("application-1", "Engineer")]));
    renderSearch();

    fireEvent.change(screen.getByRole("combobox", { name: "Search applications" }), {
      target: { value: "acme" },
    });

    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.getByText("Searching applications...")).toBeInTheDocument();

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 5,
        profileId: "profile-1",
        search: "acme",
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
    );

    expect(await screen.findByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("opens a selected result and clears the search menu", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue(applicationPage([application("application-1", "Engineer")]));
    renderSearch();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "acme" } });
    fireEvent.click(await screen.findByRole("option", { name: /Engineer/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("/applications/application-1");
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard result selection", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue(applicationPage([application("application-1", "Engineer")]));
    renderSearch();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "acme" } });
    await screen.findByRole("option", { name: /Engineer/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("location")).toHaveTextContent("/applications/application-1");
  });

  it("submits trimmed input to the full Applications search", () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    renderSearch();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "  Acme & Co  " } });
    fireEvent.submit(input.closest("form")!);

    expect(screen.getByTestId("location")).toHaveTextContent("/applications?q=Acme+%26+Co");
    expect(input).toHaveValue("Acme & Co");
  });

  it("provides a full-results action and synchronizes from the Applications query", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValue({
      ...applicationPage([application("application-1", "Engineer")]),
      totalItems: 12,
      totalPages: 3,
    });
    renderSearch("/applications?q=acme");

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("acme");
    fireEvent.focus(input);
    fireEvent.click(await screen.findByRole("button", { name: "View all 12 results" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/applications?q=acme");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ignores a stale response after the query changes", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    let resolveFirst: ((page: ApiJobApplicationsPage) => void) | undefined;
    let resolveSecond: ((page: ApiJobApplicationsPage) => void) | undefined;
    mocks.list
      .mockImplementationOnce(
        () =>
          new Promise<ApiJobApplicationsPage>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<ApiJobApplicationsPage>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    renderSearch();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "acme" } });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "beta" } });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));

    resolveSecond?.(applicationPage([application("application-2", "Beta role", "Beta")]));
    expect(await screen.findByText("Beta role")).toBeInTheDocument();

    resolveFirst?.(applicationPage([application("application-1", "Stale role")]));
    await waitFor(() => expect(screen.queryByText("Stale role")).not.toBeInTheDocument());
    expect(screen.getByText("Beta role")).toBeInTheDocument();
  });

  it("shows empty and unavailable states without discarding the query", async () => {
    mocks.me.mockResolvedValue({ id: "profile-1" });
    mocks.list.mockResolvedValueOnce(applicationPage([])).mockRejectedValueOnce(new Error("down"));
    renderSearch();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "missing" } });
    expect(await screen.findByText("No matching applications.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "unavailable" } });
    expect(
      await screen.findByText("Application search is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(input).toHaveValue("unavailable");
  });
});

function renderSearch(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchHarness />
    </MemoryRouter>,
  );
}

function SearchHarness() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TopbarApplicationSearch open={open} onOpenChange={setOpen} />
      <p data-testid="location">
        {location.pathname}
        {location.search}
      </p>
    </>
  );
}

function application(id: string, roleTitle: string, companyName = "Acme"): ApiJobApplication {
  return {
    applicationPackPreferences: {} as ApiJobApplication["applicationPackPreferences"],
    createdAt: "2026-07-18T09:00:00.000Z",
    id,
    profileId: "profile-1",
    status: "review_ready",
    tracking: {
      applicationStatus: "saved",
      companyName,
      metadata: {},
      roleTitle,
      tags: [],
    },
    updatedAt: "2026-07-18T09:00:00.000Z",
  };
}

function applicationPage(items: ApiJobApplication[]): ApiJobApplicationsPage {
  return {
    items,
    page: 1,
    pageSize: 5,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  };
}

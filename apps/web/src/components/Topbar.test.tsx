import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { notificationsApi } from "../api/notifications.js";
import { notificationsChangedEventName } from "./DesktopNotificationBridge.js";
import { Topbar } from "./Topbar";

vi.mock("../billing/CreditBalanceProvider.js", () => ({
  useCreditBalance: () => ({
    balance: { totalCredits: 10, availableCredits: 8, reservedCredits: 2 },
    balanceError: null,
    isLoading: false,
  }),
}));

describe("Topbar", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete window.electronAPI;
  });

  it("shows desktop window controls when running inside Electron", () => {
    const closeWindow = vi.fn();
    const maximizeWindow = vi.fn();
    const minimizeWindow = vi.fn();
    window.electronAPI = {
      closeWindow,
      platform: "win32",
      maximizeWindow,
      minimizeWindow,
      notifyJobApplicationQueued: vi.fn(),
    };

    renderTopbar();

    expect(screen.getByRole("button", { name: "Minimize window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize or restore window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close window" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Minimize window" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize or restore window" }));
    fireEvent.click(screen.getByRole("button", { name: "Close window" }));

    expect(minimizeWindow).toHaveBeenCalledOnce();
    expect(maximizeWindow).toHaveBeenCalledOnce();
    expect(closeWindow).toHaveBeenCalledOnce();
  });

  it("uses native macOS window controls instead of custom controls", () => {
    window.electronAPI = {
      closeWindow: vi.fn(),
      platform: "darwin",
      maximizeWindow: vi.fn(),
      minimizeWindow: vi.fn(),
      notifyJobApplicationQueued: vi.fn(),
    };

    renderTopbar();

    expect(screen.queryByRole("button", { name: "Minimize window" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Maximize or restore window" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close window" })).not.toBeInTheDocument();
  });

  it("provides a draggable region while keeping controls clickable in a frameless window", () => {
    renderTopbar();

    expect(screen.getByRole("banner")).toHaveClass("[-webkit-app-region:drag]");
    expect(screen.getByPlaceholderText("Search applications...")).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("button", { name: "Add job application" })).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("link", { name: "AI credits" })).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("link", { name: "AI credits" })).toHaveTextContent("8 credits(2 held)");
    expect(screen.getByRole("link", { name: "AI credits" })).toHaveAttribute("href", "/billing");
  });

  it("closes the notifications dropdown when clicking outside it", () => {
    renderTopbar();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Notifications")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("keeps application search and notifications mutually exclusive", () => {
    renderTopbar();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Mark all read")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Search applications" }), {
      target: { value: "acme" },
    });
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Application search results" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(
      screen.queryByRole("listbox", { name: "Application search results" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
  });

  it("opens the related application's follow-ups when a reminder is clicked", async () => {
    const notification = {
      body: "It is time to follow up on Acme - Engineer.",
      createdAt: "2026-07-18T09:00:00.000Z",
      id: "notification-1",
      jobApplicationId: "job-1",
      profileId: "profile-1",
      title: "Send a follow-up",
      type: "follow_up_reminder" as const,
    };
    vi.spyOn(notificationsApi, "unreadCount").mockResolvedValue({ count: 1 });
    vi.spyOn(notificationsApi, "list").mockResolvedValue([notification]);
    const markRead = vi.spyOn(notificationsApi, "markRead").mockResolvedValue({
      ...notification,
      readAt: "2026-07-18T09:01:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />}
          />
          <Route path="/applications/:id" element={<p>Related application follow-ups</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.click(await screen.findByRole("button", { name: /Send a follow-up/ }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith("notification-1"));
    expect(await screen.findByText("Related application follow-ups")).toBeInTheDocument();
  });

  it("refreshes the unread badge immediately after a desktop arrival", async () => {
    const unreadCount = vi
      .spyOn(notificationsApi, "unreadCount")
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    renderTopbar();
    expect(await screen.findByText("1")).toBeInTheDocument();

    window.dispatchEvent(new Event(notificationsChangedEventName));

    await waitFor(() => expect(unreadCount).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

function renderTopbar() {
  return render(
    <MemoryRouter>
      <Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />
    </MemoryRouter>,
  );
}

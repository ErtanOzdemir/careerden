import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "./Topbar";

describe("Topbar", () => {
  afterEach(() => {
    cleanup();
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
      saveLinkedInSession: vi.fn(),
      notifyJobApplicationQueued: vi.fn(),
      startLinkedInSession: vi.fn(),
      getLinkedInSessionStatus: vi.fn(),
    };

    render(<Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />);

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
      saveLinkedInSession: vi.fn(),
      notifyJobApplicationQueued: vi.fn(),
      startLinkedInSession: vi.fn(),
      getLinkedInSessionStatus: vi.fn(),
    };

    render(<Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Minimize window" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Maximize or restore window" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close window" })).not.toBeInTheDocument();
  });

  it("provides a draggable region while keeping controls clickable in a frameless window", () => {
    render(<Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />);

    expect(screen.getByRole("banner")).toHaveClass("[-webkit-app-region:drag]");
    expect(screen.getByPlaceholderText("Search applications...")).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
    expect(screen.getByRole("button", { name: "Add LinkedIn job" })).toHaveClass(
      "[-webkit-app-region:no-drag]",
    );
  });

  it("closes the notifications dropdown when clicking outside it", () => {
    render(<Topbar title="Dashboard" subtitle="Overview" onAddJob={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Notifications")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });
});

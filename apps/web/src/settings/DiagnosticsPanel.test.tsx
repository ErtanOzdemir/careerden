import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

describe("DiagnosticsPanel", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
  });

  it("renders nothing outside the local desktop edition", () => {
    const { container } = render(<DiagnosticsPanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the persisted level and turns on debug logging", async () => {
    const setLevel = vi.fn(async (level: DesktopLogLevel) => level);
    window.electronAPI = {
      logging: { getLevel: vi.fn(async () => "info" as const), setLevel },
    } as unknown as Window["electronAPI"];
    render(<DiagnosticsPanel />);

    const toggle = screen.getByRole("switch", { name: "Detailed logging" });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(setLevel).toHaveBeenCalledWith("debug");
  });

  it("reports a failed save", async () => {
    window.electronAPI = {
      logging: {
        getLevel: vi.fn(async () => "debug" as const),
        setLevel: vi.fn(async () => {
          throw new Error("disk full");
        }),
      },
    } as unknown as Window["electronAPI"];
    render(<DiagnosticsPanel />);

    const toggle = screen.getByRole("switch", { name: "Detailed logging" });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(toggle);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("copies diagnostics and opens the log and data folders through the main process", async () => {
    const copyDiagnostics = vi.fn(async () => ({ status: "copied" as const }));
    const openLogFolder = vi.fn(async () => ({ status: "opened" as const }));
    const openDataFolder = vi.fn(async () => undefined);
    window.electronAPI = {
      logging: { getLevel: vi.fn(async () => "info" as const), setLevel: vi.fn() },
      diagnostics: { copyDiagnostics, openLogFolder },
      localData: { exportData: vi.fn(), importData: vi.fn(), openDataFolder },
    } as unknown as Window["electronAPI"];
    render(<DiagnosticsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Diagnostics copied");
    expect(copyDiagnostics).toHaveBeenCalledWith();

    fireEvent.click(screen.getByRole("button", { name: "Open log folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Open data folder" }));
    await waitFor(() => expect(openLogFolder).toHaveBeenCalledWith());
    expect(openDataFolder).toHaveBeenCalledOnce();
  });

  it("reports a copy or folder failure", async () => {
    window.electronAPI = {
      logging: { getLevel: vi.fn(async () => "info" as const), setLevel: vi.fn() },
      diagnostics: {
        copyDiagnostics: vi.fn(async () => ({ status: "error" as const })),
        openLogFolder: vi.fn(async () => ({ status: "error" as const })),
      },
    } as unknown as Window["electronAPI"];
    render(<DiagnosticsPanel />);

    expect(screen.queryByRole("button", { name: "Open data folder" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be copied");

    fireEvent.click(screen.getByRole("button", { name: "Open log folder" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("log folder could not be opened"),
    );
  });
});

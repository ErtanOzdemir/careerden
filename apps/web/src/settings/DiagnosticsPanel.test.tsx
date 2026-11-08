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
});

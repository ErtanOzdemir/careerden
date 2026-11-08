import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartupRecovery } from "./StartupRecovery.js";

const snapshots = [
  {
    id: "before-migration-2026-11-05T09-15-00Z",
    kind: "before-migration",
    createdAt: "2026-11-05T09:15:00.000Z",
  },
  {
    id: "before-migration-2026-11-01T08-00-00Z",
    kind: "before-migration",
    createdAt: "2026-11-01T08:00:00.000Z",
  },
];

function installBridge(state: StartupRecoveryState | null) {
  const bridge = {
    getState: vi.fn(async () => state),
    restore: vi.fn<(id: string) => Promise<StartupRecoveryRestoreResult>>(async () => ({
      status: "restored",
    })),
    openDataFolder: vi.fn(async () => undefined),
    copyDiagnostics: vi.fn(async () => undefined),
    quit: vi.fn(async () => undefined),
  };
  const openExternal = vi.fn(async () => undefined);
  window.electronAPI = {
    notifyJobApplicationQueued: async () => undefined,
    openExternal,
    startupRecovery: bridge,
  };
  return { bridge, openExternal };
}

function renderRecovery() {
  render(
    <MemoryRouter initialEntries={["/recovery"]}>
      <Routes>
        <Route path="/recovery" element={<StartupRecovery />} />
        <Route path="/" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function state(overrides: Partial<StartupRecoveryState> = {}): StartupRecoveryState {
  return {
    reason: "migration",
    message: "A database update failed: column already exists",
    appVersion: "0.7.0",
    snapshots,
    ...overrides,
  };
}

describe("StartupRecovery", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
  });

  it("explains a failed migration and restores the chosen backup", async () => {
    const { bridge } = installBridge(state());
    renderRecovery();

    expect(
      await screen.findByRole("heading", { name: "Your data could not be updated" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A database update failed: column already exists")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked();
    fireEvent.click(radios[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Restore selected backup" }));

    await waitFor(() =>
      expect(bridge.restore).toHaveBeenCalledWith("before-migration-2026-11-01T08-00-00Z"),
    );
    expect(screen.getByRole("button", { name: "Restoring…" })).toBeDisabled();
  });

  it("shows why a restore failed and lets the user try again", async () => {
    const { bridge } = installBridge(state());
    bridge.restore.mockResolvedValueOnce({
      status: "error",
      message: "That backup is no longer available.",
    });
    renderRecovery();

    fireEvent.click(await screen.findByRole("button", { name: "Restore selected backup" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That backup is no longer available.",
    );
    expect(screen.getByRole("button", { name: "Restore selected backup" })).toBeEnabled();
  });

  it("says when there are no backups yet and keeps the other options", async () => {
    const { bridge } = installBridge(state({ reason: "database-open", snapshots: [] }));
    renderRecovery();

    expect(await screen.findByText("No backups are available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restore/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open data folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostic info" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quit app" }));

    expect(bridge.openDataFolder).toHaveBeenCalledOnce();
    expect(bridge.copyDiagnostics).toHaveBeenCalledOnce();
    expect(bridge.quit).toHaveBeenCalledOnce();
  });

  it("asks for the latest version when the data comes from a newer one", async () => {
    const { openExternal } = installBridge(
      state({
        reason: "newer-version",
        message: "This data was created by a newer version of Careerden.",
      }),
    );
    renderRecovery();

    expect(
      await screen.findByRole("heading", {
        name: "This data was created by a newer version of Careerden",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Please install the latest version/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download the latest version" }));
    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/ErtanOzdemir/careerden/releases/latest",
    );
  });

  it("returns to the app when the local data opened normally", async () => {
    installBridge(null);
    renderRecovery();

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });
});

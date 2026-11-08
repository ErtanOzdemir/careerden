import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalDataSettings, type LocalDataBridge } from "./LocalDataSettings";

const summary: LocalBackupSummary = {
  createdAt: "2026-11-01T09:30:00.000Z",
  appVersion: "0.7.0",
  applications: 12,
  files: 1,
};

function createBridge(overrides: Partial<LocalDataBridge> = {}): LocalDataBridge {
  return {
    exportData: vi.fn(
      async (): Promise<LocalDataExportResult> => ({
        status: "exported",
        fileName: "careerden-unplugged-backup-2026-11-06.careerden",
        summary,
      }),
    ),
    importData: vi.fn(
      async (): Promise<LocalDataImportResult> => ({
        status: "imported",
        snapshotFileName: "before-import-2026-11-06T10-15-30Z.careerden",
        summary,
      }),
    ),
    openDataFolder: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("LocalDataSettings", () => {
  afterEach(cleanup);

  it("exports through the desktop app and names the saved file", async () => {
    const bridge = createBridge();
    render(<LocalDataSettings bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved careerden-unplugged-backup-2026-11-06.careerden with 12 applications.",
    );
    expect(bridge.exportData).toHaveBeenCalledOnce();
  });

  it("shows nothing when the save dialog is canceled", async () => {
    const bridge = createBridge({
      exportData: vi.fn(async () => ({ status: "canceled" as const })),
    });
    render(<LocalDataSettings bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(await screen.findByRole("button", { name: /export data/i })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("confirms before importing and reloads once the import finished", async () => {
    const bridge = createBridge();
    const reload = vi.fn();
    render(<LocalDataSettings bridge={bridge} reload={reload} />);

    fireEvent.click(screen.getByRole("button", { name: /import from backup/i }));
    expect(screen.getByRole("heading", { name: "Import from backup?" })).toBeInTheDocument();
    expect(bridge.importData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Choose backup…" }));

    expect(await screen.findByRole("heading", { name: "Backup imported" })).toBeInTheDocument();
    expect(screen.getByText(/Restored 12 applications and 1 file/)).toBeInTheDocument();
    expect(screen.getByText("before-import-2026-11-06T10-15-30Z.careerden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("shows why a backup was rejected and keeps the dialog open", async () => {
    const bridge = createBridge({
      importData: vi.fn(async () => ({
        status: "error" as const,
        message: "This backup was made by a newer version of Careerden Unplugged (0.9.0).",
      })),
    });
    const reload = vi.fn();
    render(<LocalDataSettings bridge={bridge} reload={reload} />);

    fireEvent.click(screen.getByRole("button", { name: /import from backup/i }));
    fireEvent.click(screen.getByRole("button", { name: "Choose backup…" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This backup was made by a newer version of Careerden Unplugged (0.9.0). Your existing data is still in place.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the data folder through the desktop app", () => {
    const bridge = createBridge();
    render(<LocalDataSettings bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: /open data folder/i }));

    expect(bridge.openDataFolder).toHaveBeenCalledOnce();
  });
});

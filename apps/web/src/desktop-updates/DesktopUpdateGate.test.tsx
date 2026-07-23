import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopUpdateGate } from "./DesktopUpdateGate.js";
import { DesktopUpdateProvider } from "./DesktopUpdateProvider.js";

describe("DesktopUpdateGate", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it("blocks the renderer when the cached policy requires an update", async () => {
    const checkForDesktopUpdates = installUpdateBridge({
      currentVersion: "0.1.6",
      minimumSupportedVersion: "0.2.0",
      required: true,
      status: "error",
    });

    renderGate();

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "A required update is available",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(checkForDesktopUpdates).toHaveBeenCalledOnce();
  });

  it("offers restart or later after an optional update downloads", async () => {
    const restartAndInstallDesktopUpdate = vi.fn().mockResolvedValue(undefined);
    installUpdateBridge(
      {
        availableVersion: "0.1.7",
        currentVersion: "0.1.6",
        downloadPercent: 100,
        required: false,
        status: "ready",
      },
      restartAndInstallDesktopUpdate,
    );

    renderGate();

    expect(await screen.findByRole("dialog")).toHaveTextContent("Update ready to install");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(restartAndInstallDesktopUpdate).not.toHaveBeenCalled();
  });

  it("renders nothing in a normal browser without the Electron bridge", () => {
    renderGate();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

function renderGate() {
  render(
    <DesktopUpdateProvider>
      <DesktopUpdateGate />
    </DesktopUpdateProvider>,
  );
}

function installUpdateBridge(
  state: DesktopUpdateState,
  restartAndInstallDesktopUpdate = vi.fn().mockResolvedValue(undefined),
) {
  const checkForDesktopUpdates = vi.fn().mockResolvedValue(undefined);
  window.electronAPI = {
    getLinkedInSessionStatus: vi.fn(),
    startLinkedInSession: vi.fn(),
    saveLinkedInSession: vi.fn(),
    notifyJobApplicationQueued: vi.fn(),
    getDesktopUpdateState: vi.fn().mockResolvedValue(state),
    checkForDesktopUpdates,
    restartAndInstallDesktopUpdate,
    onDesktopUpdateStateChanged: vi.fn(() => () => undefined),
  };
  return checkForDesktopUpdates;
}

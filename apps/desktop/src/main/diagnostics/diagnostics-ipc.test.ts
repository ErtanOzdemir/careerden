import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { IpcHandlerRegistry } from "../ipc-handlers-registry.js";
import { isTrustedMainWindowIpcSender } from "../ipc-sender-policy.js";
import {
  diagnosticsIpcChannels,
  registerDiagnosticsIpc,
  type DiagnosticsIpcOptions,
} from "./diagnostics-ipc.js";

// Registers the channels behind the same sender policy as the app: the main window's main frame.
function register(overrides: Partial<DiagnosticsIpcOptions> = {}) {
  const options: DiagnosticsIpcOptions = {
    collect: vi.fn(async () => "## Careerden Unplugged diagnostics\n"),
    writeClipboard: vi.fn(),
    logsDirectory: "/user-data/logs",
    ensureDirectory: vi.fn(async () => undefined),
    openPath: vi.fn(async () => ""),
    onError: vi.fn(),
    ...overrides,
  };
  const mainFrame = {};
  const webContents = { mainFrame };
  const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow;
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const registry = new IpcHandlerRegistry(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    (event) => isTrustedMainWindowIpcSender(event, window),
  );
  registerDiagnosticsIpc(registry, options);

  return {
    options,
    channels: [...handlers.keys()],
    fromMainFrame: (channel: string, ...args: unknown[]) =>
      handlers.get(channel)!(
        { sender: webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent,
        ...args,
      ),
    fromSubframe: (channel: string) =>
      handlers.get(channel)!({ sender: webContents, senderFrame: {} } as IpcMainInvokeEvent),
  };
}

describe("registerDiagnosticsIpc", () => {
  it("serves its channels to the main window's main frame only", () => {
    const ipc = register();

    expect(ipc.channels.sort()).toEqual(Object.values(diagnosticsIpcChannels).sort());
    for (const channel of ipc.channels) {
      expect(() => ipc.fromSubframe(channel)).toThrow("IPC sender is not trusted");
    }
    expect(ipc.options.writeClipboard).not.toHaveBeenCalled();
    expect(ipc.options.openPath).not.toHaveBeenCalled();
  });

  it("copies the summary in the main process and returns only a status", async () => {
    const ipc = register();

    await expect(ipc.fromMainFrame(diagnosticsIpcChannels.copy)).resolves.toEqual({
      status: "copied",
    });
    expect(ipc.options.writeClipboard).toHaveBeenCalledWith("## Careerden Unplugged diagnostics\n");
  });

  it("reports a failed copy without throwing", async () => {
    const ipc = register({
      collect: async () => {
        throw new Error("boom");
      },
    });

    await expect(ipc.fromMainFrame(diagnosticsIpcChannels.copy)).resolves.toEqual({
      status: "error",
    });
    expect(ipc.options.writeClipboard).not.toHaveBeenCalled();
    expect(ipc.options.onError).toHaveBeenCalledWith("diagnostics.copy_failed", expect.any(Error));
  });

  // shell.openPath is Electron's cross-platform API: Finder on macOS, Explorer on Windows, and
  // the desktop's default file manager through xdg-open on Linux.
  it.each([
    ["darwin", "/Users/ada/Library/Application Support/Careerden Unplugged/logs"],
    ["win32", "C:\\Users\\ada\\AppData\\Roaming\\Careerden Unplugged\\logs"],
    ["linux", "/home/ada/.config/Careerden Unplugged/logs"],
  ])("opens the log folder it was given on %s, ignoring renderer arguments", async (_, logs) => {
    const ipc = register({ logsDirectory: logs });

    await expect(ipc.fromMainFrame(diagnosticsIpcChannels.openLogFolder, "/etc")).resolves.toEqual({
      status: "opened",
    });
    expect(ipc.options.ensureDirectory).toHaveBeenCalledWith(logs);
    expect(ipc.options.openPath).toHaveBeenCalledWith(logs);
    expect(ipc.options.openPath).toHaveBeenCalledOnce();
  });

  it("reports a folder the operating system could not open", async () => {
    const ipc = register({ openPath: async () => "No application is associated" });

    await expect(ipc.fromMainFrame(diagnosticsIpcChannels.openLogFolder)).resolves.toEqual({
      status: "error",
    });
    expect(ipc.options.onError).toHaveBeenCalledWith(
      "diagnostics.open_log_folder_failed",
      expect.any(Error),
    );
  });

  it("reports a log folder that cannot be created", async () => {
    const ipc = register({
      ensureDirectory: async () => {
        throw new Error("EACCES");
      },
    });

    await expect(ipc.fromMainFrame(diagnosticsIpcChannels.openLogFolder)).resolves.toEqual({
      status: "error",
    });
    expect(ipc.options.openPath).not.toHaveBeenCalled();
  });
});

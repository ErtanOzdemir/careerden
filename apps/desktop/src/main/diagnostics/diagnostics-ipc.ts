export const diagnosticsIpcChannels = {
  copy: "desktop-diagnostics-copy",
  openLogFolder: "desktop-diagnostics-open-log-folder",
} as const;

// Results carry a status only: the summary goes to the clipboard and the folder path stays in
// the main process.
export type DiagnosticsCopyResult = { status: "copied" } | { status: "error" };
export type OpenLogFolderResult = { status: "opened" } | { status: "error" };

export interface DiagnosticsIpcOptions {
  collect: () => Promise<string>;
  writeClipboard: (text: string) => void;
  // userData/logs, fixed by the main process.
  logsDirectory: string;
  ensureDirectory: (path: string) => Promise<void>;
  // Electron's shell.openPath: resolves an empty string on success and a message on failure. It
  // opens folders in Finder, Explorer, or the desktop's file manager.
  openPath: (path: string) => Promise<string>;
  onError?: (event: string, error: unknown) => void;
}

interface IpcRegistrar {
  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): unknown;
}

// Local edition only. Neither channel takes an argument, so the renderer cannot choose a path.
export function registerDiagnosticsIpc(
  registry: IpcRegistrar,
  options: DiagnosticsIpcOptions,
): void {
  registry.register(diagnosticsIpcChannels.copy, async (): Promise<DiagnosticsCopyResult> => {
    try {
      options.writeClipboard(await options.collect());
      return { status: "copied" };
    } catch (error) {
      options.onError?.("diagnostics.copy_failed", error);
      return { status: "error" };
    }
  });

  registry.register(
    diagnosticsIpcChannels.openLogFolder,
    async (): Promise<OpenLogFolderResult> => {
      try {
        // The folder may not exist yet when nothing has been logged.
        await options.ensureDirectory(options.logsDirectory);
        const failure = await options.openPath(options.logsDirectory);
        if (!failure) return { status: "opened" };
        options.onError?.("diagnostics.open_log_folder_failed", new Error(failure));
      } catch (error) {
        options.onError?.("diagnostics.open_log_folder_failed", error);
      }
      return { status: "error" };
    },
  );
}

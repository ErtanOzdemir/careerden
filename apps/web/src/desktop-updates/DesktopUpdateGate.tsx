import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button.js";
import { Modal } from "../components/careerden/modal.js";
import { useDesktopUpdates } from "./DesktopUpdateProvider.js";
import { useState } from "react";

const desktopReleasesUrl = "https://github.com/ErtanOzdemir/careerden/releases/latest";

export function DesktopUpdateGate() {
  const { checkForUpdates, restartAndInstall, state } = useDesktopUpdates();
  const [dismissedVersion, setDismissedVersion] = useState<string>();

  if (!state) return null;

  if (!state.required) {
    const showOptionalUpdate =
      state.status === "ready" &&
      state.availableVersion !== undefined &&
      dismissedVersion !== state.availableVersion;

    return (
      <Modal open={showOptionalUpdate} onClose={() => setDismissedVersion(state.availableVersion)}>
        <div className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info">
          <Download className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Update ready to install</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Careerden {state.availableVersion} has been downloaded. Restart now to install it, or
          continue working and update when you quit.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDismissedVersion(state.availableVersion)}>
            Later
          </Button>
          <Button onClick={() => void restartAndInstall()}>Restart and update</Button>
        </div>
      </Modal>
    );
  }

  const isReady = state.status === "ready";
  const isChecking = state.status === "checking";
  const isDownloading = state.status === "available" || state.status === "downloading";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6"
      role="alertdialog"
      aria-labelledby="required-update-title"
      aria-describedby="required-update-description"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          {isReady ? <Download className="size-7" /> : <AlertTriangle className="size-7" />}
        </div>
        <h1 id="required-update-title" className="mt-5 text-xl font-semibold text-foreground">
          A required update is available
        </h1>
        <p id="required-update-description" className="mt-2 text-sm text-muted-foreground">
          Careerden {state.currentVersion} is no longer supported. Update to continue using the
          desktop app.
        </p>
        {state.minimumSupportedVersion && (
          <p className="mt-2 text-xs text-muted-foreground">
            Minimum supported version: {state.minimumSupportedVersion}
          </p>
        )}

        {isDownloading && (
          <div className="mt-6">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${state.downloadPercent ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Downloading update
              {state.downloadPercent === undefined ? "…" : ` ${state.downloadPercent}%`}
            </p>
          </div>
        )}

        {state.errorMessage && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            The update could not be downloaded. Check your connection and try again.
          </p>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {isReady ? (
            <Button onClick={() => void restartAndInstall()}>
              <Download className="size-4" />
              Restart and update
            </Button>
          ) : (
            <Button disabled={isChecking || isDownloading} onClick={() => void checkForUpdates()}>
              <RefreshCw className={isChecking ? "size-4 animate-spin" : "size-4"} />
              {isChecking ? "Checking…" : isDownloading ? "Downloading…" : "Try again"}
            </Button>
          )}
          {state.status === "error" && (
            <Button
              variant="ghost"
              onClick={() => void window.electronAPI?.openExternal?.(desktopReleasesUrl)}
            >
              Download manually
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

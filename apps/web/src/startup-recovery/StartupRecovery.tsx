import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle, ClipboardCopy, Download, FolderOpen, History, Power } from "lucide-react";
import { Button } from "../components/ui/button.js";
import { desktopReleasesUrl } from "../desktop-updates/DesktopUpdateGate.js";

export const startupRecoveryPath = "/recovery";

const headlines: Record<StartupRecoveryReason, { title: string; description: string }> = {
  "newer-version": {
    title: "This data was created by a newer version of Careerden",
    description:
      "Please install the latest version of Careerden Unplugged to open it. Your data has not been changed.",
  },
  migration: {
    title: "Your data could not be updated",
    description:
      "Careerden Unplugged could not update your data for this version. Nothing has been deleted.",
  },
  "database-open": {
    title: "Your data could not be opened",
    description:
      "The database files could not be read. They may be damaged or come from an incompatible version.",
  },
  "crash-loop": {
    title: "Careerden Unplugged keeps stopping",
    description:
      "The local data service stopped several times in a row, so automatic restarts were paused.",
  },
  "start-failed": {
    title: "Careerden Unplugged could not start",
    description: "The local data service did not start. Your data has not been changed.",
  },
};

const snapshotKinds: Record<string, string> = {
  "before-migration": "Before a database update",
  "before-import": "Before an import",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

// Local edition only. Shown in place of the app when the local data cannot be opened. Uses only
// the desktop bridge: the backend is not running, so there is no API to call.
export function StartupRecovery() {
  const bridge = window.electronAPI?.startupRecovery;
  const [state, setState] = useState<StartupRecoveryState | null>();
  const [selectedId, setSelectedId] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let mounted = true;
    void bridge.getState().then(
      (next) => {
        if (!mounted) return;
        setState(next);
        setSelectedId(next?.snapshots[0]?.id);
      },
      () => mounted && setState(null),
    );
    return () => {
      mounted = false;
    };
  }, [bridge]);

  if (!bridge || state === null) return <Navigate to="/" replace />;
  if (state === undefined) return null;

  const headline = headlines[state.reason];

  async function restore() {
    if (!bridge || !selectedId) return;
    setRestoring(true);
    setRestoreError(undefined);
    // The app relaunches when the restore succeeds.
    const result = await bridge
      .restore(selectedId)
      .catch(() => ({ status: "error" as const, message: "The backup could not be restored." }));
    if (result.status === "error") {
      setRestoreError(result.message);
      setRestoring(false);
    }
  }

  async function copyDiagnostics() {
    await bridge?.copyDiagnostics();
    setCopied(true);
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background p-6 [-webkit-app-region:drag]"
      aria-labelledby="startup-recovery-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-xl [-webkit-app-region:no-drag]">
        <div className="flex size-12 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <AlertTriangle className="size-6" />
        </div>
        <h1 id="startup-recovery-title" className="mt-5 text-xl font-semibold text-foreground">
          {headline.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{headline.description}</p>
        {state.reason === "newer-version" && (
          <Button
            className="mt-4"
            onClick={() => void window.electronAPI?.openExternal?.(desktopReleasesUrl)}
          >
            <Download className="size-4" />
            Download the latest version
          </Button>
        )}
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Error details</summary>
          <p className="mt-2 rounded-lg bg-muted p-3 font-mono break-words">{state.message}</p>
        </details>

        <section className="mt-6 border-t border-border pt-6" aria-labelledby="restore-title">
          <h2 id="restore-title" className="text-sm font-semibold text-foreground">
            Restore from a backup
          </h2>
          {state.snapshots.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No backups are available yet.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Your current data is kept in the backups folder, and the app restarts afterwards.
              </p>
              <fieldset className="mt-3 space-y-2" disabled={restoring}>
                <legend className="sr-only">Backups</legend>
                {state.snapshots.map((snapshot) => (
                  <label
                    key={snapshot.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary"
                  >
                    <input
                      type="radio"
                      name="snapshot"
                      value={snapshot.id}
                      checked={selectedId === snapshot.id}
                      onChange={() => setSelectedId(snapshot.id)}
                    />
                    <span className="font-medium text-foreground">
                      {snapshotKinds[snapshot.kind] ?? "Backup"}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {dateFormat.format(new Date(snapshot.createdAt))}
                    </span>
                  </label>
                ))}
              </fieldset>
              {restoreError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {restoreError}
                </p>
              )}
              <Button
                className="mt-3"
                disabled={!selectedId || restoring}
                onClick={() => void restore()}
              >
                <History className="size-4" />
                {restoring ? "Restoring…" : "Restore selected backup"}
              </Button>
            </>
          )}
        </section>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
          <Button variant="outline" onClick={() => void bridge.openDataFolder()}>
            <FolderOpen className="size-4" />
            Open data folder
          </Button>
          <Button variant="outline" onClick={() => void copyDiagnostics()}>
            <ClipboardCopy className="size-4" />
            {copied ? "Copied" : "Copy diagnostic info"}
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => void bridge.quit()}>
            <Power className="size-4" />
            Quit app
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Version {state.appVersion}</p>
      </div>
    </main>
  );
}

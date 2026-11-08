import { useEffect, useState } from "react";
import { ClipboardCopy, FileText, FolderOpen } from "lucide-react";
import { Panel } from "../components/careerden/panel.js";
import { Toggle } from "../components/careerden/toggle.js";
import { Button } from "../components/ui/button.js";
import { cn } from "../lib/utils.js";

type Feedback = { tone: "success" | "error"; message: string };

// Local desktop edition only: the app keeps a redacted log file on this device.
export function DiagnosticsPanel() {
  const logging = window.electronAPI?.logging;
  const diagnostics = window.electronAPI?.diagnostics;
  // The data folder action belongs to the backup bridge; reuse it rather than adding another.
  const localData = window.electronAPI?.localData;
  const [level, setLevel] = useState<DesktopLogLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!logging) return;
    let active = true;
    logging
      .getLevel()
      .then((current) => {
        if (active) setLevel(current);
      })
      .catch(() => {
        if (active) setLevel("info");
      });
    return () => {
      active = false;
    };
  }, [logging]);

  if (!logging) return null;

  async function handleChange(debug: boolean) {
    if (!logging) return;
    setIsSaving(true);
    setError(null);
    try {
      setLevel(await logging.setLevel(debug ? "debug" : "info"));
    } catch {
      setError("The logging setting could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    if (!diagnostics) return;
    setIsCopying(true);
    setFeedback(null);
    const result = await diagnostics.copyDiagnostics().catch(() => ({ status: "error" as const }));
    setFeedback(
      result.status === "copied"
        ? {
            tone: "success",
            message: "Diagnostics copied. Paste them into your GitHub issue.",
          }
        : { tone: "error", message: "The diagnostics could not be copied." },
    );
    setIsCopying(false);
  }

  async function handleOpenLogFolder() {
    if (!diagnostics) return;
    setFeedback(null);
    const result = await diagnostics.openLogFolder().catch(() => ({ status: "error" as const }));
    if (result.status === "error") {
      setFeedback({ tone: "error", message: "The log folder could not be opened." });
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-2.5 px-5 py-4">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Diagnostics</h2>
      </div>
      <div className="divide-y divide-border border-t border-border">
        <Toggle
          checked={level === "debug"}
          disabled={level === null || isSaving}
          label="Detailed logging"
          desc="Record extra detail in the log file on this device. Logs never include API keys, profile content, or job postings."
          onChange={(checked) => void handleChange(checked)}
        />
      </div>
      {diagnostics && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Reporting a problem? Copy a summary of your app version, system, and recent log lines to
            paste into the issue. It never includes API keys or your profile.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isCopying}
              onClick={() => void handleCopy()}
            >
              <ClipboardCopy className="size-3.5" /> {isCopying ? "Copying…" : "Copy diagnostics"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleOpenLogFolder()}>
              <FolderOpen className="size-3.5" /> Open log folder
            </Button>
            {localData && (
              <Button variant="ghost" size="sm" onClick={() => void localData.openDataFolder()}>
                <FolderOpen className="size-3.5" /> Open data folder
              </Button>
            )}
          </div>
          {feedback && (
            <p
              role={feedback.tone === "success" ? "status" : "alert"}
              className={cn(
                "text-sm",
                feedback.tone === "success" ? "text-success" : "text-destructive",
              )}
            >
              {feedback.message}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </Panel>
  );
}

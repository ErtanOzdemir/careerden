import { useState } from "react";
import { Database, Download, FolderOpen, TriangleAlert, Upload } from "lucide-react";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/careerden/panel.js";
import { Modal } from "../components/careerden/modal.js";
import { cn } from "../lib/utils.js";

export type LocalDataBridge = NonNullable<NonNullable<Window["electronAPI"]>["localData"]>;

type Feedback = { tone: "success" | "error"; message: string } | null;
type ImportStep =
  | { kind: "confirm"; error?: string }
  | { kind: "importing" }
  | { kind: "done"; summary: LocalBackupSummary; snapshotFileName: string };

// Local edition only: everything lives on this device, so backups are the way to move or keep it.
// The desktop app opens every file dialog; this panel only asks it to start.
export function LocalDataSettings({
  bridge,
  reload = () => window.location.reload(),
}: {
  bridge: LocalDataBridge;
  reload?: () => void;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [importStep, setImportStep] = useState<ImportStep | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setFeedback(null);
    try {
      const result = await bridge.exportData();
      if (result.status === "exported") {
        setFeedback({
          tone: "success",
          message: `Saved ${result.fileName} with ${pluralize(result.summary.applications, "application")}.`,
        });
      } else if (result.status === "error") {
        setFeedback({ tone: "error", message: result.message });
      }
    } catch {
      setFeedback({ tone: "error", message: "The backup could not be created." });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport() {
    setImportStep({ kind: "importing" });
    try {
      const result = await bridge.importData();
      if (result.status === "imported") {
        setImportStep({
          kind: "done",
          summary: result.summary,
          snapshotFileName: result.snapshotFileName,
        });
      } else if (result.status === "error") {
        setImportStep({ kind: "confirm", error: result.message });
      } else {
        setImportStep({ kind: "confirm" });
      }
    } catch {
      setImportStep({ kind: "confirm", error: "The backup could not be imported." });
    }
  }

  function closeImport() {
    if (importStep?.kind === "importing") return;
    // The data behind every open page was replaced; start over from it.
    if (importStep?.kind === "done") reload();
    setImportStep(null);
  }

  return (
    <Panel>
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Database className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Your data</h2>
      </div>
      <div className="space-y-4 border-t border-border px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Your applications, documents, and files are stored only on this computer. Export a backup
          to keep a copy or to move to another computer. AI provider keys are not included; add
          yours again after importing.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            <Download className="size-3.5" /> {isExporting ? "Exporting…" : "Export data"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportStep({ kind: "confirm" })}>
            <Upload className="size-3.5" /> Import from backup
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void bridge.openDataFolder()}>
            <FolderOpen className="size-3.5" /> Open data folder
          </Button>
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

      <Modal open={importStep !== null} onClose={closeImport}>
        {importStep?.kind === "done" ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">Backup imported</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Restored {pluralize(importStep.summary.applications, "application")} and{" "}
              {pluralize(importStep.summary.files, "file")} from a backup made on{" "}
              {formatDate(importStep.summary.createdAt)}. Your previous data was saved as{" "}
              <span className="font-medium text-foreground">{importStep.snapshotFileName}</span> in
              the backups folder next to your data folder.
            </p>
            <div className="mt-6 flex justify-end">
              <Button onClick={closeImport}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground">Import from backup?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything in Careerden Unplugged is replaced by the backup you choose. Your current
              data is saved as a backup first, so you can go back to it.
            </p>
            {importStep?.kind === "confirm" && importStep.error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{importStep.error} Your existing data is still in place.</span>
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={importStep?.kind === "importing"}
                onClick={closeImport}
              >
                Cancel
              </Button>
              <Button
                disabled={importStep?.kind === "importing"}
                onClick={() => void handleImport()}
              >
                {importStep?.kind === "importing" ? "Importing…" : "Choose backup…"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </Panel>
  );
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

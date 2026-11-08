import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Panel } from "../components/careerden/panel.js";
import { Toggle } from "../components/careerden/toggle.js";

// Local desktop edition only: the app keeps a redacted log file on this device.
export function DiagnosticsPanel() {
  const logging = window.electronAPI?.logging;
  const [level, setLevel] = useState<DesktopLogLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {error && (
        <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </Panel>
  );
}

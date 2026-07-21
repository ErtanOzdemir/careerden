import { useState } from "react";
import { Modal } from "./careerden/modal.js";
import { Button } from "./ui/button.js";
import { Link2, Sparkles } from "lucide-react";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";

export function AddJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [tone, setTone] = useState<"concise" | "creative" | "professional">("professional");
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setUrl("");
    setQueuedMessage(null);
    setError(null);
    setLanguage("auto");
    setTone("professional");
    onClose();
  }

  async function handleSubmit() {
    if (!url.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      setQueuedMessage(null);
      const profile = await profilesApi.me();
      const trimmedUrl = url.trim();
      const applicationPackPreferences = { language, tone };

      if (window.electronAPI) {
        await jobApplicationsApi.create({
          profileId: profile.id,
          sourceUrl: trimmedUrl,
          applicationPackPreferences,
        });
        void window.electronAPI.notifyJobApplicationQueued();
      } else {
        await jobApplicationsApi.create({
          profileId: profile.id,
          jobUrl: trimmedUrl,
          applicationPackPreferences,
        });
      }

      setUrl("");
      setLanguage("auto");
      setTone("professional");
      setQueuedMessage("Job queued for processing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Link2 className="size-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Add a LinkedIn job</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the URL of a LinkedIn job posting. We'll extract the role, company, and requirements
          automatically.
        </p>

        {queuedMessage && <p className="mt-3 text-sm text-success">{queuedMessage}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 space-y-2">
          <label htmlFor="job-url" className="text-sm font-medium text-foreground">
            Job posting URL
          </label>
          <input
            id="job-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            Profile-aware analysis runs automatically once the job is added.
          </p>
          <details className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Customize output
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                Language
                <select
                  aria-label="Application pack language"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  onChange={(event) => setLanguage(event.target.value)}
                  value={language}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="tr">Turkish</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Tone
                <select
                  aria-label="Application pack tone"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  onChange={(event) => setTone(event.target.value as typeof tone)}
                  value={tone}
                >
                  <option value="professional">Professional</option>
                  <option value="concise">Concise</option>
                  <option value="creative">Creative</option>
                </select>
              </label>
            </div>
          </details>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || isSaving}>
            {isSaving ? "Adding..." : "Add & process"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

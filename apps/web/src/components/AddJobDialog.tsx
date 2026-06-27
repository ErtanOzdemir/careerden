import { useState } from "react";
import { Modal } from "./link2cv/modal.js";
import { Button } from "./ui/button.js";
import { Link2, Sparkles, Check } from "lucide-react";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiScrapeBundle } from "../api/types.js";

export function AddJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setUrl("");
    setSubmitted(false);
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!url.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      const profile = await profilesApi.me();
      const trimmedUrl = url.trim();

      if (window.electronAPI) {
        const created = await jobApplicationsApi.create({
          profileId: profile.id,
          sourceUrl: trimmedUrl,
        });
        const scrapeBundle = (await window.electronAPI.scrapeLinkedInJob(
          trimmedUrl,
        )) as ApiScrapeBundle;
        await jobApplicationsApi.updateStatus(created.id, "scraping");
        await jobApplicationsApi.submitScrapeData(created.id, {
          sourceUrl: trimmedUrl,
          scrapeBundle,
        });
      } else {
        await jobApplicationsApi.create({
          profileId: profile.id,
          jobUrl: trimmedUrl,
        });
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      {submitted ? (
        <div className="py-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Job added to your queue</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Link2CV is extracting the job details and running your match analysis in the background.
            You can keep working.
          </p>
          <Button className="mt-5" onClick={handleClose}>
            Got it
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Link2 className="size-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Add a LinkedIn job</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste the URL of a LinkedIn job posting. We'll extract the role, company, and
            requirements automatically.
          </p>

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
      )}
    </Modal>
  );
}

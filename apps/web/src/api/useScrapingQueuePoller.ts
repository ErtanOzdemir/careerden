import { useEffect } from "react";
import { jobApplicationsApi } from "./jobApplications.js";
import type { ApiScrapeBundle } from "./types.js";

export const jobApplicationQueuedEvent = "link2cv:job-application-queued";

export function useScrapingQueuePoller(profileId: string | null): void {
  useEffect(() => {
    const electronApi = window.electronAPI;

    if (!profileId || !electronApi) {
      return;
    }

    let active = true;
    let isPolling = false;

    const poll = async () => {
      if (isPolling) {
        return;
      }

      isPolling = true;

      try {
        const queued = await jobApplicationsApi.list({
          profileId,
          processingStatus: "queued",
        });

        for (const job of queued) {
          if (!active || !job.sourceUrl) {
            continue;
          }

          try {
            await jobApplicationsApi.updateStatus(job.id, "scraping");

            const scrapeBundle = (await electronApi.scrapeLinkedInJob(
              job.sourceUrl,
            )) as ApiScrapeBundle;

            await jobApplicationsApi.submitScrapeData(job.id, {
              sourceUrl: job.sourceUrl,
              scrapeBundle,
            });
          } catch (err) {
            await jobApplicationsApi.updateStatus(job.id, "failed");
            console.error(`[ScrapingPoller] Failed to process job ${job.id}:`, err);
          }
        }
      } catch {
        // poll error — will retry next interval
      } finally {
        isPolling = false;
      }
    };

    const handleJobQueued = () => {
      void poll();
    };

    void poll();
    window.addEventListener(jobApplicationQueuedEvent, handleJobQueued);
    const interval = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(jobApplicationQueuedEvent, handleJobQueued);
    };
  }, [profileId]);
}

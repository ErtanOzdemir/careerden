import { useEffect } from "react";
import { jobApplicationsApi } from "./jobApplications.js";
import type { ApiScrapeBundle } from "./types.js";

export function useScrapingQueuePoller(profileId: string | null): void {
  useEffect(() => {
    const electronApi = window.electronAPI;

    if (!profileId || !electronApi) {
      return;
    }

    let active = true;

    const poll = async () => {
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
            const scrapeBundle = (await electronApi.scrapeLinkedInJob(
              job.sourceUrl,
            )) as ApiScrapeBundle;

            await jobApplicationsApi.updateStatus(job.id, "scraping");
            await jobApplicationsApi.submitScrapeData(job.id, {
              sourceUrl: job.sourceUrl,
              scrapeBundle,
            });
          } catch (err) {
            console.error(`[ScrapingPoller] Failed to process job ${job.id}:`, err);
          }
        }
      } catch {
        // poll error — will retry next interval
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [profileId]);
}

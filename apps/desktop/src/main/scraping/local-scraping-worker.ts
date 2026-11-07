import type { ScrapingFailureCategory } from "@careerden/contracts";
import type { ScrapeBundle } from "@careerden/domain";
import { toScrapingFailure } from "../../domain/scraping/scraping-failure.js";
import { DesktopApiError, isTerminalClaimApiError } from "./desktop-api-error.js";

export interface ClaimedScrapeJob {
  id: string;
  sourceUrl?: string;
}

export interface DesktopScrapingApiClient {
  claimNextScrapeJob(): Promise<ClaimedScrapeJob | null>;
  failScrapeJob(
    jobApplicationId: string,
    reason: string,
    category?: ScrapingFailureCategory,
  ): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  renewScrapeClaim(jobApplicationId: string): Promise<void>;
  submitScrapeData(
    jobApplicationId: string,
    input: { sourceUrl: string; scrapeBundle: ScrapeBundle },
  ): Promise<void>;
}

export interface LinkedInScrapingRunner {
  scrape(sourceUrl: string): Promise<ScrapeBundle>;
}

// Scraping more postings while LinkedIn blocks or rate-limits guest requests extends the block.
const throttledCategories: ReadonlySet<ScrapingFailureCategory> = new Set([
  "blocked",
  "rate_limited",
]);
const defaultThrottleCooldownMs = 10 * 60_000;

type ClaimOutcome = "continue" | "throttled";

export class LocalScrapingWorker {
  private interval: NodeJS.Timeout | undefined;
  private isRunning = false;
  private pausedUntil = 0;

  constructor(
    private readonly dependencies: {
      api: DesktopScrapingApiClient;
      heartbeatMs?: number;
      intervalMs?: number;
      now?: () => number;
      runner: LinkedInScrapingRunner;
      /** How long scheduled runs pause after LinkedIn blocks or rate-limits a scrape. */
      throttleCooldownMs?: number;
    },
  ) {}

  start(): void {
    if (this.interval) {
      return;
    }

    this.runWithCatch();
    this.interval = setInterval(
      () => this.runWithCatch({ scheduled: true }),
      this.dependencies.intervalMs ?? 30_000,
    );
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  /** Runs now, even during a throttle pause, because a user queued or retried a scrape. */
  wake(): void {
    this.runWithCatch();
  }

  async runOnce(options: { scheduled?: boolean } = {}): Promise<void> {
    if (this.isRunning || (options.scheduled && this.now() < this.pausedUntil)) {
      return;
    }

    this.isRunning = true;

    try {
      if (!(await this.dependencies.api.isAuthenticated())) {
        return;
      }

      await this.drainQueue();
    } finally {
      this.isRunning = false;
    }
  }

  private async drainQueue(): Promise<void> {
    while (true) {
      const claimed = await this.dependencies.api.claimNextScrapeJob();

      if (!claimed) {
        return;
      }

      if ((await this.processClaimedJob(claimed)) === "throttled") {
        this.pausedUntil =
          this.now() + (this.dependencies.throttleCooldownMs ?? defaultThrottleCooldownMs);
        return;
      }
    }
  }

  private now(): number {
    return this.dependencies.now?.() ?? Date.now();
  }

  private runWithCatch(options: { scheduled?: boolean } = {}): void {
    void this.runOnce(options).catch((error) => {
      if (isExpectedStartupError(error)) {
        return;
      }

      console.error("Local scraping worker failed", error);
    });
  }

  private async processClaimedJob(claimed: ClaimedScrapeJob): Promise<ClaimOutcome> {
    if (!claimed.sourceUrl) {
      await this.dependencies.api.failScrapeJob(claimed.id, "Claimed job has no source URL");
      return "continue";
    }

    const heartbeat = this.startHeartbeat(claimed.id);

    try {
      let scrapeBundle: ScrapeBundle;

      try {
        scrapeBundle = await this.dependencies.runner.scrape(claimed.sourceUrl);
      } catch (error) {
        const failure = toScrapingFailure(error);

        console.warn("LinkedIn scrape failed", {
          category: failure.category,
          detail: failure.detail,
          jobApplicationId: claimed.id,
        });
        await this.dependencies.api.failScrapeJob(claimed.id, failure.message, failure.category);
        return throttledCategories.has(failure.category) ? "throttled" : "continue";
      }

      try {
        await this.dependencies.api.submitScrapeData(claimed.id, {
          sourceUrl: claimed.sourceUrl,
          scrapeBundle,
        });
      } catch (error) {
        if (isTerminalClaimApiError(error)) {
          console.warn("Desktop dropped scrape claim after terminal API response", {
            code: error.code,
            jobApplicationId: claimed.id,
            message: error.message,
            status: error.status,
          });
          return "continue";
        }

        await this.dependencies.api.failScrapeJob(claimed.id, errorMessage(error));
      }

      return "continue";
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }
  }

  private startHeartbeat(jobApplicationId: string): NodeJS.Timeout | undefined {
    const heartbeatMs = this.dependencies.heartbeatMs ?? 60_000;

    if (heartbeatMs <= 0) {
      return undefined;
    }

    return setInterval(() => {
      void this.dependencies.api.renewScrapeClaim(jobApplicationId).catch(() => undefined);
    }, heartbeatMs);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown LinkedIn scraping error";
}

function isExpectedStartupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message === "fetch failed" ||
    (error instanceof DesktopApiError && [401, 403, 503].includes(error.status))
  );
}

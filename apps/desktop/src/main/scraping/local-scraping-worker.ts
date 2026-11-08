import type { ScrapeBundle } from "@careerden/domain";
import type { LogFieldValue, StructuredLogger } from "@careerden/infrastructure/logging";
import { consoleStructuredLogger, describeErrorForLog } from "@careerden/infrastructure/logging";
import { DesktopApiError, isTerminalClaimApiError } from "./desktop-api-error.js";

export interface ClaimedScrapeJob {
  id: string;
  sourceUrl?: string;
}

export interface DesktopScrapingApiClient {
  claimNextScrapeJob(): Promise<ClaimedScrapeJob | null>;
  failScrapeJob(jobApplicationId: string, reason: string): Promise<void>;
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

export class LocalScrapingWorker {
  private interval: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly dependencies: {
      api: DesktopScrapingApiClient;
      heartbeatMs?: number;
      intervalMs?: number;
      log?: StructuredLogger;
      runner: LinkedInScrapingRunner;
    },
  ) {}

  private get log(): StructuredLogger {
    return this.dependencies.log ?? consoleStructuredLogger;
  }

  start(): void {
    if (this.interval) {
      return;
    }

    this.runWithCatch();
    this.interval = setInterval(() => this.runWithCatch(), this.dependencies.intervalMs ?? 30_000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  wake(): void {
    this.runWithCatch();
  }

  async runOnce(): Promise<void> {
    if (this.isRunning) {
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

      await this.processClaimedJob(claimed);
    }
  }

  private runWithCatch(): void {
    void this.runOnce().catch((error) => {
      if (isExpectedStartupError(error)) {
        return;
      }

      this.log({
        level: "error",
        event: "scraping.worker_failed",
        fields: describeApiErrorForLog(error),
      });
    });
  }

  private async processClaimedJob(claimed: ClaimedScrapeJob): Promise<void> {
    if (!claimed.sourceUrl) {
      await this.dependencies.api.failScrapeJob(claimed.id, "Claimed job has no source URL");
      return;
    }

    const heartbeat = this.startHeartbeat(claimed.id);

    try {
      let scrapeBundle: ScrapeBundle;

      try {
        scrapeBundle = await this.dependencies.runner.scrape(claimed.sourceUrl);
      } catch (error) {
        await this.dependencies.api.failScrapeJob(claimed.id, errorMessage(error));
        return;
      }

      try {
        await this.dependencies.api.submitScrapeData(claimed.id, {
          sourceUrl: claimed.sourceUrl,
          scrapeBundle,
        });
      } catch (error) {
        if (isTerminalClaimApiError(error)) {
          this.log({
            level: "warn",
            event: "scraping.claim_dropped",
            fields: { jobApplicationId: claimed.id, ...describeApiErrorForLog(error) },
          });
          return;
        }

        await this.dependencies.api.failScrapeJob(claimed.id, errorMessage(error));
      }
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

// Adds the trace ID the API returns with its fixed internal error response.
function describeApiErrorForLog(error: unknown): Record<string, LogFieldValue> {
  const fields = describeErrorForLog(error);
  if (error instanceof DesktopApiError) {
    if (error.code) fields.errorCode = error.code;
    if (typeof error.details.traceId === "string") fields.traceId = error.details.traceId;
  }
  return fields;
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

import type { UtilityProcess } from "electron";
import { utilityProcess } from "electron";
import { randomUUID } from "node:crypto";
import type { ScrapeBundle } from "@careerden/domain";
import type { LinkedInScrapingRunner } from "./local-scraping-worker.js";
import type { ScrapingUtilityResponse } from "./scraping-utility-messages.js";

export type UtilityProcessFork = (
  modulePath: string,
  args?: string[],
  options?: Parameters<typeof utilityProcess.fork>[2],
) => Pick<UtilityProcess, "kill" | "on" | "postMessage">;

interface PendingScrape {
  reject: (error: Error) => void;
  resolve: (scrapeBundle: ScrapeBundle) => void;
  timeout: NodeJS.Timeout;
}

export class UtilityProcessLinkedInScrapingRunner implements LinkedInScrapingRunner {
  private pending = new Map<string, PendingScrape>();
  private process: Pick<UtilityProcess, "kill" | "on" | "postMessage"> | undefined;

  constructor(
    private readonly options: {
      fork?: UtilityProcessFork;
      modulePath: string;
      scrapeTimeoutMs?: number;
      sessionDirectory: string;
      sessionEncryptionKey: string;
    },
  ) {}

  scrape(sourceUrl: string): Promise<ScrapeBundle> {
    const requestId = randomUUID();
    const child = this.ensureProcess();

    return new Promise((resolve, reject) => {
      const scrapeTimeoutMs = this.options.scrapeTimeoutMs ?? 300_000;
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            `LinkedIn scraping utility process did not respond within ${scrapeTimeoutMs}ms`,
          ),
        );
      }, scrapeTimeoutMs);

      this.pending.set(requestId, { reject, resolve, timeout });
      child.postMessage({
        type: "scrape",
        requestId,
        sourceUrl,
        sessionDirectory: this.options.sessionDirectory,
        sessionEncryptionKey: this.options.sessionEncryptionKey,
      });
    });
  }

  dispose(): void {
    this.process?.kill();
    this.process = undefined;
    this.rejectPending(new Error("LinkedIn scraping utility process was disposed"));
  }

  private ensureProcess(): Pick<UtilityProcess, "kill" | "on" | "postMessage"> {
    if (this.process) {
      return this.process;
    }

    const fork = this.options.fork ?? utilityProcess.fork;
    const child = fork(this.options.modulePath, [], {
      serviceName: "careerden-linkedin-scraper",
    });

    child.on("message", (message: unknown) => this.handleMessage(message));
    child.on("exit", (code: number) => {
      this.process = undefined;
      this.rejectPending(new Error(`LinkedIn scraping utility process exited with code ${code}`));
    });

    this.process = child;
    return child;
  }

  private handleMessage(message: unknown): void {
    if (!isUtilityResponse(message)) {
      return;
    }

    const pending = this.pending.get(message.requestId);

    if (!pending) {
      return;
    }

    this.pending.delete(message.requestId);
    clearTimeout(pending.timeout);

    if (message.type === "scrape:success") {
      pending.resolve(message.scrapeBundle);
      return;
    }

    pending.reject(new Error(message.message));
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }

    this.pending.clear();
  }
}

function isUtilityResponse(message: unknown): message is ScrapingUtilityResponse {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const payload = message as Record<string, unknown>;

  if (payload.type === "scrape:error") {
    return typeof payload.requestId === "string" && typeof payload.message === "string";
  }

  return (
    payload.type === "scrape:success" &&
    typeof payload.requestId === "string" &&
    typeof payload.scrapeBundle === "object" &&
    payload.scrapeBundle !== null
  );
}

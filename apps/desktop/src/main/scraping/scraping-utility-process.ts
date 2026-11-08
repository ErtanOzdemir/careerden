import process from "node:process";
import { describeErrorForLog, type StructuredLogEntry } from "@careerden/infrastructure/logging";
import { ScrapeLinkedInJobUseCase } from "../../application/scraping/scrape-linkedin-job.use-case.js";
import { LinkedInCompanyScraper } from "../../infrastructure/scraping/adapters/linkedin-company.scraper.js";
import { LinkedInJobScraper } from "../../infrastructure/scraping/adapters/linkedin-job.scraper.js";
import { createStructuredLogMessage } from "../logging/structured-log-message.js";
import { categorizeScrapeError } from "./scrape-error-category.js";
import {
  parseScrapingUtilityRequest,
  type ScrapingUtilityResponse,
} from "./scraping-utility-messages.js";

const parentPort = process.parentPort;

if (!parentPort) {
  throw new Error("Scraping utility process requires an Electron parent port");
}

parentPort.on("message", (message: unknown) => {
  void handleMessage(message);
});

async function handleMessage(message: unknown): Promise<void> {
  const request = parseScrapingUtilityRequest(message);

  if (!request) {
    return;
  }

  const startedAt = Date.now();
  try {
    const scrapeLinkedInJob = new ScrapeLinkedInJobUseCase(
      new LinkedInJobScraper(),
      new LinkedInCompanyScraper(),
    );
    const scrapeBundle = await scrapeLinkedInJob.execute(request.sourceUrl);
    log({
      level: "debug",
      event: "scrape.succeeded",
      fields: {
        durationMs: Date.now() - startedAt,
        hasLinkedInCompany: scrapeBundle.companyLinkedIn !== undefined,
      },
    });

    postMessage({
      type: "scrape:success",
      requestId: request.requestId,
      scrapeBundle,
    });
  } catch (error) {
    log({
      level: "warn",
      event: "scrape.failed",
      fields: {
        category: categorizeScrapeError(error),
        durationMs: Date.now() - startedAt,
        ...describeErrorForLog(error),
      },
    });
    postMessage({
      type: "scrape:error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Unknown LinkedIn scraping error",
    });
  }
}

// The main process owns the log file; entries travel over the parent port.
function log(entry: StructuredLogEntry): void {
  parentPort.postMessage(createStructuredLogMessage(entry));
}

function postMessage(message: ScrapingUtilityResponse): void {
  parentPort.postMessage(message);
}

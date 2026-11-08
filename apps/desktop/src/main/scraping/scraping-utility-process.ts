import process from "node:process";
import { toScrapeFailureReason } from "@careerden/domain";
import { ScrapeLinkedInJobUseCase } from "../../application/scraping/scrape-linkedin-job.use-case.js";
import { LinkedInCompanyScraper } from "../../infrastructure/scraping/adapters/linkedin-company.scraper.js";
import { LinkedInJobScraper } from "../../infrastructure/scraping/adapters/linkedin-job.scraper.js";
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

  try {
    const scrapeLinkedInJob = new ScrapeLinkedInJobUseCase(
      new LinkedInJobScraper(),
      new LinkedInCompanyScraper(),
    );
    const scrapeBundle = await scrapeLinkedInJob.execute(request.sourceUrl);

    postMessage({
      type: "scrape:success",
      requestId: request.requestId,
      scrapeBundle,
    });
  } catch (error) {
    postMessage({
      type: "scrape:error",
      requestId: request.requestId,
      // Only the message crosses the process boundary, so classify while the error type is known.
      message: toScrapeFailureReason(error),
    });
  }
}

function postMessage(message: ScrapingUtilityResponse): void {
  parentPort.postMessage(message);
}

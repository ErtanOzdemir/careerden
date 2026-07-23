import type { ScrapeBundle } from "@careerden/domain";

export interface ScrapeRequestMessage {
  type: "scrape";
  requestId: string;
  sourceUrl: string;
  sessionDirectory: string;
  sessionEncryptionKey: string;
}

export interface ScrapeSuccessMessage {
  type: "scrape:success";
  requestId: string;
  scrapeBundle: ScrapeBundle;
}

export interface ScrapeErrorMessage {
  type: "scrape:error";
  requestId: string;
  message: string;
}

export type ScrapingUtilityRequest = ScrapeRequestMessage;
export type ScrapingUtilityResponse = ScrapeSuccessMessage | ScrapeErrorMessage;

export function parseScrapingUtilityRequest(message: unknown): ScrapingUtilityRequest | undefined {
  const payload = unwrapMessageEvent(message);

  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const request = payload as Record<string, unknown>;

  if (
    request.type === "scrape" &&
    typeof request.requestId === "string" &&
    typeof request.sourceUrl === "string" &&
    typeof request.sessionDirectory === "string" &&
    typeof request.sessionEncryptionKey === "string"
  ) {
    return request as unknown as ScrapingUtilityRequest;
  }

  return undefined;
}

function unwrapMessageEvent(message: unknown): unknown {
  if (typeof message === "object" && message !== null && "data" in message && "ports" in message) {
    return (message as { data: unknown }).data;
  }

  return message;
}

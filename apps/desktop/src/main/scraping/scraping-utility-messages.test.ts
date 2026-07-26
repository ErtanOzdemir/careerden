import { describe, expect, it } from "vitest";
import { parseScrapingUtilityRequest } from "./scraping-utility-messages.js";

describe("parseScrapingUtilityRequest", () => {
  it("unwraps Electron parent port message events", () => {
    const request = {
      type: "scrape",
      requestId: "request-a",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    };

    expect(parseScrapingUtilityRequest({ data: request, ports: [] })).toEqual(request);
  });
});

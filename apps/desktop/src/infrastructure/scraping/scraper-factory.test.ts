import { describe, expect, it } from "vitest";
import { LinkedInJobScraper } from "./adapters/linkedin-job.scraper.js";
import { ScraperFactory } from "./scraper-factory.js";

describe("ScraperFactory", () => {
  it("routes LinkedIn job URLs to the LinkedIn scraper", () => {
    const scraper = new LinkedInJobScraper();
    const factory = new ScraperFactory([scraper]);

    expect(factory.fromUrl("https://www.linkedin.com/jobs/view/123")).toBe(scraper);
  });
});

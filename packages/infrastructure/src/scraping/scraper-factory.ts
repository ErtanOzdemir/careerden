import type { JobSiteScraper } from "@link2cv/domain";

export class ScraperFactory {
  constructor(private readonly scrapers: JobSiteScraper[]) {}

  fromUrl(url: string): JobSiteScraper {
    const scraper = this.scrapers.find((candidate) => candidate.canHandle(url));

    if (!scraper) {
      throw new Error(`No scraper registered for URL: ${url}`);
    }

    return scraper;
  }
}

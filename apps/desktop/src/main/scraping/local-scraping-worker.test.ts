import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { LocalScrapingWorker } from "./local-scraping-worker.js";
import type { DesktopScrapingApiClient, LinkedInScrapingRunner } from "./local-scraping-worker.js";

describe("LocalScrapingWorker", () => {
  it("waits without claiming scrape tasks when the desktop app is unauthenticated", async () => {
    const api = createApiClient({
      isAuthenticated: vi.fn(async () => false),
    });
    const runner = createRunner();
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(api.isAuthenticated).toHaveBeenCalledOnce();
    expect(api.claimNextScrapeJob).not.toHaveBeenCalled();
    expect(runner.scrape).not.toHaveBeenCalled();
  });

  it("does nothing when there is no claimed scrape task", async () => {
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => null),
    });
    const runner = createRunner();
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(api.claimNextScrapeJob).toHaveBeenCalledOnce();
    expect(runner.scrape).not.toHaveBeenCalled();
    expect(api.submitScrapeData).not.toHaveBeenCalled();
  });

  it("scrapes and submits a claimed task", async () => {
    const scrapeBundle = {
      job: {
        title: "Engineer",
        companyName: "Acme",
        description: "Build software",
        requirements: [],
        raw: {},
      },
    };
    const api = createApiClient({
      claimNextScrapeJob: vi
        .fn()
        .mockResolvedValueOnce({
          id: "job-1",
          sourceUrl: "https://www.linkedin.com/jobs/view/1",
        })
        .mockResolvedValueOnce(null),
    });
    const runner = createRunner({
      scrape: vi.fn(async () => scrapeBundle),
    });
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(runner.scrape).toHaveBeenCalledWith("https://www.linkedin.com/jobs/view/1");
    expect(api.submitScrapeData).toHaveBeenCalledWith("job-1", {
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
      scrapeBundle,
    });
    expect(api.failScrapeJob).not.toHaveBeenCalled();
  });

  it("continues claiming jobs until the local queue is drained", async () => {
    const scrapeBundle = {
      job: {
        title: "Engineer",
        companyName: "Acme",
        description: "Build software",
        requirements: [],
        raw: {},
      },
    };
    const api = createApiClient({
      claimNextScrapeJob: vi
        .fn()
        .mockResolvedValueOnce({
          id: "job-1",
          sourceUrl: "https://www.linkedin.com/jobs/view/1",
        })
        .mockResolvedValueOnce({
          id: "job-2",
          sourceUrl: "https://www.linkedin.com/jobs/view/2",
        })
        .mockResolvedValueOnce(null),
    });
    const runner = createRunner({
      scrape: vi.fn(async () => scrapeBundle),
    });
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(api.claimNextScrapeJob).toHaveBeenCalledTimes(3);
    expect(runner.scrape).toHaveBeenCalledTimes(2);
    expect(api.submitScrapeData).toHaveBeenCalledTimes(2);
  });

  it("renews the active scrape claim while scraping is still running", async () => {
    let resolveScrape: (
      value: Awaited<ReturnType<LinkedInScrapingRunner["scrape"]>>,
    ) => void = () => {};
    const scrapeBundle = {
      job: {
        title: "Engineer",
        companyName: "Acme",
        description: "Build software",
        requirements: [],
        raw: {},
      },
    };
    const api = createApiClient({
      claimNextScrapeJob: vi
        .fn()
        .mockResolvedValueOnce({
          id: "job-1",
          sourceUrl: "https://www.linkedin.com/jobs/view/1",
        })
        .mockResolvedValueOnce(null),
    });
    const runner = createRunner({
      scrape: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveScrape = resolve;
          }),
      ),
    });
    const worker = new LocalScrapingWorker({ api, heartbeatMs: 1, runner });

    const run = worker.runOnce();
    await delay(5);
    resolveScrape(scrapeBundle);
    await run;

    expect(api.renewScrapeClaim).toHaveBeenCalledWith("job-1");
    expect(api.submitScrapeData).toHaveBeenCalledOnce();
  });

  it("reports a scrape failure for the claimed task", async () => {
    const api = createApiClient({
      claimNextScrapeJob: vi
        .fn()
        .mockResolvedValueOnce({
          id: "job-1",
          sourceUrl: "https://www.linkedin.com/jobs/view/1",
        })
        .mockResolvedValueOnce(null),
    });
    const runner = createRunner({
      scrape: vi.fn(async () => {
        throw new Error("LinkedIn session expired");
      }),
    });
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(api.failScrapeJob).toHaveBeenCalledWith("job-1", "LinkedIn session expired");
    expect(api.submitScrapeData).not.toHaveBeenCalled();
  });

  it("does not run overlapping polls", async () => {
    let resolveClaim: (value: null) => void = () => {};
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(
        () =>
          new Promise<null>((resolve) => {
            resolveClaim = resolve;
          }),
      ),
    });
    const runner = createRunner();
    const worker = new LocalScrapingWorker({ api, runner });

    const first = worker.runOnce();
    const second = worker.runOnce();
    await vi.waitFor(() => expect(api.claimNextScrapeJob).toHaveBeenCalledOnce());
    resolveClaim(null);
    await Promise.all([first, second]);

    expect(api.claimNextScrapeJob).toHaveBeenCalledOnce();
  });

  it("does not log expected unauthenticated scheduler failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => {
        throw new Error("API request failed with status 401");
      }),
    });
    const worker = new LocalScrapingWorker({ api, runner: createRunner(), intervalMs: 1 });

    worker.start();
    await delay(5);
    worker.stop();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not log expected API startup connection failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    const worker = new LocalScrapingWorker({ api, runner: createRunner(), intervalMs: 1 });

    worker.start();
    await delay(5);
    worker.stop();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("logs claim failures instead of rejecting from the scheduler", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => {
        throw new Error("API request failed with status 500");
      }),
    });
    const worker = new LocalScrapingWorker({ api, runner: createRunner(), intervalMs: 1 });

    worker.start();
    await delay(5);
    worker.stop();

    expect(consoleError).toHaveBeenCalledWith("Local scraping worker failed", expect.any(Error));
    consoleError.mockRestore();
  });
});

function createApiClient(
  overrides: Partial<DesktopScrapingApiClient> = {},
): DesktopScrapingApiClient {
  return {
    claimNextScrapeJob: vi.fn(async () => null),
    failScrapeJob: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => true),
    renewScrapeClaim: vi.fn(async () => undefined),
    submitScrapeData: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRunner(overrides: Partial<LinkedInScrapingRunner> = {}): LinkedInScrapingRunner {
  return {
    scrape: vi.fn(),
    ...overrides,
  };
}

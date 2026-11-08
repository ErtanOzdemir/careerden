import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { LocalScrapingWorker } from "./local-scraping-worker.js";
import type { DesktopScrapingApiClient, LinkedInScrapingRunner } from "./local-scraping-worker.js";
import { DesktopApiError } from "./desktop-api-error.js";

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
        throw new Error("LinkedIn public job details unavailable");
      }),
    });
    const worker = new LocalScrapingWorker({ api, runner });

    await worker.runOnce();

    expect(api.failScrapeJob).toHaveBeenCalledWith(
      "job-1",
      "scrape_unknown: LinkedIn public job details unavailable",
    );
    expect(api.submitScrapeData).not.toHaveBeenCalled();
  });

  it("keeps the category of a classified scrape failure", async () => {
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
        // The utility process forwards only the encoded message.
        throw new Error("scrape_rate_limited: LinkedIn public fetch failed: 429 Too Many Requests");
      }),
    });

    await new LocalScrapingWorker({ api, runner }).runOnce();

    expect(api.failScrapeJob).toHaveBeenCalledWith(
      "job-1",
      "scrape_rate_limited: LinkedIn public fetch failed: 429 Too Many Requests",
    );
  });

  it("stops draining and pauses scheduled runs after LinkedIn blocks a scrape", async () => {
    let now = 1_000;
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => ({
        id: "job-1",
        sourceUrl: "https://www.linkedin.com/jobs/view/1",
      })),
    });
    const runner = createRunner({
      scrape: vi.fn(async () => {
        throw new Error("scrape_blocked: LinkedIn public fetch failed: 999 Request denied");
      }),
    });
    const worker = new LocalScrapingWorker({
      api,
      now: () => now,
      runner,
      throttleCooldownMs: 60_000,
    });

    await worker.runOnce({ scheduled: true });
    expect(api.claimNextScrapeJob).toHaveBeenCalledTimes(1);

    now += 30_000;
    await worker.runOnce({ scheduled: true });
    expect(api.claimNextScrapeJob).toHaveBeenCalledTimes(1);

    // A user action still runs during the pause.
    await worker.runOnce();
    expect(api.claimNextScrapeJob).toHaveBeenCalledTimes(2);

    now += 120_000;
    await worker.runOnce({ scheduled: true });
    expect(api.claimNextScrapeJob).toHaveBeenCalledTimes(3);
  });

  it.each([
    [400, "validation"],
    [404, "not_found"],
    [409, "conflict"],
  ] as const)(
    "drops a terminal %s submission response without reporting another failure",
    async (status, code) => {
      const log = vi.fn();
      const api = createApiClient({
        claimNextScrapeJob: vi
          .fn()
          .mockResolvedValueOnce({
            id: "job-1",
            sourceUrl: "https://www.linkedin.com/jobs/view/1",
          })
          .mockResolvedValueOnce(null),
        submitScrapeData: vi.fn(async () => {
          throw new DesktopApiError(status, "Terminal response", code);
        }),
      });
      const worker = new LocalScrapingWorker({
        api,
        log,
        runner: createRunner({
          scrape: vi.fn(async () => ({
            job: {
              title: "Engineer",
              companyName: "Acme",
              description: "Build software",
              requirements: [],
              raw: {},
            },
          })),
        }),
      });

      await worker.runOnce();

      expect(api.failScrapeJob).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith({
        level: "warn",
        event: "scraping.claim_dropped",
        fields: expect.objectContaining({
          errorCode: code,
          jobApplicationId: "job-1",
          statusCode: status,
        }),
      });
    },
  );

  it("reports an unexpected submission failure through the failure endpoint", async () => {
    const api = createApiClient({
      claimNextScrapeJob: vi
        .fn()
        .mockResolvedValueOnce({
          id: "job-1",
          sourceUrl: "https://www.linkedin.com/jobs/view/1",
        })
        .mockResolvedValueOnce(null),
      submitScrapeData: vi.fn(async () => {
        throw new DesktopApiError(500, "Unexpected server error", "internal");
      }),
    });
    const worker = new LocalScrapingWorker({
      api,
      runner: createRunner({
        scrape: vi.fn(async () => ({
          job: {
            title: "Engineer",
            companyName: "Acme",
            description: "Build software",
            requirements: [],
            raw: {},
          },
        })),
      }),
    });

    await worker.runOnce();

    expect(api.failScrapeJob).toHaveBeenCalledWith("job-1", "Unexpected server error");
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
        throw new DesktopApiError(401, "Unauthorized", "unauthorized");
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

  it("logs claim failures with the API trace ID instead of rejecting from the scheduler", async () => {
    const log = vi.fn();
    const api = createApiClient({
      claimNextScrapeJob: vi.fn(async () => {
        throw new DesktopApiError(500, "Internal server error", "internal", { traceId: "trace-1" });
      }),
    });
    const worker = new LocalScrapingWorker({ api, log, runner: createRunner(), intervalMs: 1 });

    worker.start();
    await delay(5);
    worker.stop();

    expect(log).toHaveBeenCalledWith({
      level: "error",
      event: "scraping.worker_failed",
      fields: expect.objectContaining({
        errorCode: "internal",
        statusCode: 500,
        traceId: "trace-1",
      }),
    });
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

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { UtilityProcessLinkedInScrapingRunner } from "./utility-process-linkedin-scraping-runner.js";

describe("UtilityProcessLinkedInScrapingRunner", () => {
  it("rejects scrape requests when the utility process does not respond before timeout", async () => {
    vi.useFakeTimers();
    const child = createUtilityProcess();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork: vi.fn(() => child),
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
      scrapeTimeoutMs: 100,
    });

    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");
    const rejection = expect(scrapePromise).rejects.toThrow(
      "LinkedIn scraping utility process did not respond within 100ms",
    );

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    vi.useRealTimers();
  });

  it("resolves scrape requests from utility process success messages", async () => {
    const child = createUtilityProcess();
    const fork = vi.fn(() => child);
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork,
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
    });
    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");
    const request = child.messages[0] as { requestId: string };
    const scrapeBundle = {
      job: {
        title: "Engineer",
        companyName: "Acme",
        description: "Build software",
        requirements: [],
        raw: {},
      },
    };

    child.emit("message", {
      type: "scrape:success",
      requestId: request.requestId,
      scrapeBundle,
    });

    await expect(scrapePromise).resolves.toEqual(scrapeBundle);
    expect(child.messages[0]).toEqual({
      type: "scrape",
      requestId: expect.any(String),
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
  });

  it("rejects scrape requests from utility process error messages", async () => {
    const child = createUtilityProcess();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork: vi.fn(() => child),
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
    });
    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");
    const request = child.messages[0] as { requestId: string };

    child.emit("message", {
      type: "scrape:error",
      requestId: request.requestId,
      message: "LinkedIn redirected to login",
    });

    await expect(scrapePromise).rejects.toThrow("LinkedIn redirected to login");
  });

  it("rejects pending scrape requests when the utility process exits", async () => {
    const child = createUtilityProcess();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork: vi.fn(() => child),
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
    });
    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");

    child.emit("exit", 1);

    await expect(scrapePromise).rejects.toThrow(
      "LinkedIn scraping utility process exited with code 1",
    );
  });

  it("forwards utility process log entries and logs unexpected exits", async () => {
    const child = createUtilityProcess();
    const log = vi.fn();
    const childLog = vi.fn();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      childLog,
      fork: vi.fn(() => child),
      log,
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
    });
    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");

    child.emit("message", {
      type: "log",
      entry: { level: "warn", event: "scrape.failed", fields: { statusCode: 429 } },
    });
    child.emit("exit", 1);

    await expect(scrapePromise).rejects.toThrow();
    expect(childLog).toHaveBeenCalledWith({
      level: "warn",
      event: "scrape.failed",
      fields: { statusCode: 429 },
    });
    expect(log).toHaveBeenCalledWith({
      level: "warn",
      event: "scraper.unexpected_exit",
      fields: { exitCode: 1 },
    });
  });

  it("does not log an exit it caused by disposing", () => {
    const child = createUtilityProcess();
    const log = vi.fn();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork: vi.fn(() => child),
      log,
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
    });
    void runner.scrape("https://www.linkedin.com/jobs/view/1").catch(() => undefined);

    runner.dispose();
    child.emit("exit", 0);

    expect(log).not.toHaveBeenCalled();
  });
});

function createUtilityProcess() {
  const emitter = new EventEmitter();
  const messages: unknown[] = [];

  return Object.assign(emitter, {
    kill: vi.fn(() => true),
    messages,
    postMessage: vi.fn((message: unknown) => {
      messages.push(message);
    }),
  });
}

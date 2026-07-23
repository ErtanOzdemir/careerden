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
      sessionDirectory: "/user/linkedin-session",
      sessionEncryptionKey: "encoded-key",
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
      sessionDirectory: "/user/linkedin-session",
      sessionEncryptionKey: "encoded-key",
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
    expect(child.messages[0]).toMatchObject({
      type: "scrape",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
      sessionDirectory: "/user/linkedin-session",
      sessionEncryptionKey: "encoded-key",
    });
  });

  it("rejects scrape requests from utility process error messages", async () => {
    const child = createUtilityProcess();
    const runner = new UtilityProcessLinkedInScrapingRunner({
      fork: vi.fn(() => child),
      modulePath: "/dist/main/scraping/scraping-utility-process.js",
      sessionDirectory: "/user/linkedin-session",
      sessionEncryptionKey: "encoded-key",
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
      sessionDirectory: "/user/linkedin-session",
      sessionEncryptionKey: "encoded-key",
    });
    const scrapePromise = runner.scrape("https://www.linkedin.com/jobs/view/1");

    child.emit("exit", 1);

    await expect(scrapePromise).rejects.toThrow(
      "LinkedIn scraping utility process exited with code 1",
    );
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

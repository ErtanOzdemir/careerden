import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobApplicationQueuedEvent, useScrapingQueuePoller } from "./useScrapingQueuePoller";

vi.mock("./jobApplications.js", () => ({
  jobApplicationsApi: {
    list: vi.fn(),
    submitScrapeData: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

import { jobApplicationsApi } from "./jobApplications.js";

function TestPoller() {
  useScrapingQueuePoller("profile-1");
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useScrapingQueuePoller", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it("processes queued jobs immediately when a job is queued", async () => {
    const scrape = deferred<unknown>();
    window.electronAPI = {
      closeWindow: vi.fn(),
      getLinkedInSessionStatus: vi.fn(),
      maximizeWindow: vi.fn(),
      minimizeWindow: vi.fn(),
      platform: "darwin",
      saveLinkedInSession: vi.fn(),
      scrapeLinkedInJob: vi.fn(() => scrape.promise),
      startLinkedInSession: vi.fn(),
    };
    vi.mocked(jobApplicationsApi.list).mockResolvedValue([
      {
        id: "job-1",
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
      },
    ] as never);
    vi.mocked(jobApplicationsApi.updateStatus).mockResolvedValue({} as never);
    vi.mocked(jobApplicationsApi.submitScrapeData).mockResolvedValue({} as never);

    render(<TestPoller />);
    window.dispatchEvent(new CustomEvent(jobApplicationQueuedEvent));

    await waitFor(() => {
      expect(jobApplicationsApi.updateStatus).toHaveBeenCalledWith("job-1", "scraping");
    });
    expect(window.electronAPI.scrapeLinkedInJob).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/view/123",
    );

    scrape.resolve({
      job: {
        companyName: "Acme",
        description: "Build products",
        raw: {},
        requirements: [],
        title: "Engineer",
      },
    });

    await waitFor(() => {
      expect(jobApplicationsApi.submitScrapeData).toHaveBeenCalledWith("job-1", {
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
        scrapeBundle: {
          job: {
            companyName: "Acme",
            description: "Build products",
            raw: {},
            requirements: [],
            title: "Engineer",
          },
        },
      });
    });
  });
});

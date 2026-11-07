import type { ScrapingFailureCategory } from "@careerden/contracts";
import type { ScrapeBundle } from "@careerden/domain";
import type { ClaimedScrapeJob, DesktopScrapingApiClient } from "./local-scraping-worker.js";
import { DesktopApiError } from "./desktop-api-error.js";

export interface DesktopApiCookie {
  name: string;
  value: string;
}

export class DesktopApiClient implements DesktopScrapingApiClient {
  private readonly apiBaseUrl: string;

  constructor(
    private readonly options: {
      apiBaseUrl: string;
      claimedBy: string;
      // Cloud edition: the signed-in session cookies.
      getCookies?: () => Promise<DesktopApiCookie[]>;
      // Local edition: the per-launch backend token, which is always present.
      headers?: Record<string, string>;
    },
  ) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
  }

  async claimNextScrapeJob(): Promise<ClaimedScrapeJob | null> {
    const response = await this.request("/job-applications/scraping/claim", {
      body: {
        claimedBy: this.options.claimedBy,
      },
      method: "POST",
    });

    if (response.status === 204) {
      return null;
    }

    const payload = (await response.json()) as Partial<ClaimedScrapeJob>;

    if (typeof payload.id !== "string") {
      throw new Error("Scrape claim response did not include a job application id");
    }

    return {
      id: payload.id,
      sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : undefined,
    };
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.options.getCookies) return true;
    const cookies = await this.options.getCookies();
    return cookies.some((cookie) => isSessionCookie(cookie.name));
  }

  async submitScrapeData(
    jobApplicationId: string,
    input: { sourceUrl: string; scrapeBundle: ScrapeBundle },
  ): Promise<void> {
    await this.request(`/job-applications/${jobApplicationId}/scrape-data`, {
      body: {
        ...input,
        claimedBy: this.options.claimedBy,
      },
      method: "PUT",
    });
  }

  async failScrapeJob(
    jobApplicationId: string,
    reason: string,
    category?: ScrapingFailureCategory,
  ): Promise<void> {
    await this.request(`/job-applications/${jobApplicationId}/scraping/fail`, {
      body: {
        claimedBy: this.options.claimedBy,
        reason,
        ...(category ? { category } : {}),
      },
      method: "POST",
    });
  }

  async renewScrapeClaim(jobApplicationId: string): Promise<void> {
    await this.request(`/job-applications/${jobApplicationId}/scraping/heartbeat`, {
      body: {
        claimedBy: this.options.claimedBy,
      },
      method: "POST",
    });
  }

  private async request(
    path: string,
    input: { body?: unknown; method: "GET" | "POST" | "PUT" },
  ): Promise<Response> {
    const headers: Record<string, string> = { ...this.options.headers };

    if (input.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const cookieHeader = await this.cookieHeader();

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      headers,
      method: input.method,
    });

    if (!response.ok && response.status !== 204) {
      throw await DesktopApiError.fromResponse(response);
    }

    return response;
  }

  private async cookieHeader(): Promise<string> {
    if (!this.options.getCookies) return "";
    const cookies = await this.options.getCookies();
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }
}

function isSessionCookie(name: string): boolean {
  const normalized = name.replace(/^__(Secure|Host)-/, "");
  return normalized === "session_token" || /(^|[.-])session_token$/.test(normalized);
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopApiClient } from "./desktop-api-client.js";
import { DesktopApiError } from "./desktop-api-error.js";

describe("DesktopApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims scrape jobs with API auth cookies only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "job-1",
              sourceUrl: "https://www.linkedin.com/jobs/view/1",
            }),
            { status: 200 },
          ),
      ),
    );
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => [
        { name: "better-auth.session_token", value: "api-cookie" },
        { name: "other", value: "other-cookie" },
      ]),
    });

    await expect(client.claimNextScrapeJob()).resolves.toEqual({
      id: "job-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:3000/job-applications/scraping/claim", {
      body: JSON.stringify({ claimedBy: "desktop-a" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "better-auth.session_token=api-cookie; other=other-cookie",
      },
      method: "POST",
    });
  });

  it("detects Better Auth session cookies for authenticated desktop polling", async () => {
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => [
        { name: "__Secure-better-auth.session_token", value: "api-cookie" },
        { name: "other", value: "other-cookie" },
      ]),
    });

    await expect(client.isAuthenticated()).resolves.toBe(true);
  });

  it("treats missing Better Auth session cookies as unauthenticated", async () => {
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => [{ name: "other", value: "other-cookie" }]),
    });

    await expect(client.isAuthenticated()).resolves.toBe(false);
  });

  it("submits scrape data with the desktop claim owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
    );
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => []),
    });
    const scrapeBundle = {
      job: {
        title: "Engineer",
        companyName: "Acme",
        description: "Build software",
        requirements: [],
        raw: {},
      },
    };

    await client.submitScrapeData("job-1", {
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
      scrapeBundle,
    });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:3000/job-applications/job-1/scrape-data", {
      body: JSON.stringify({
        sourceUrl: "https://www.linkedin.com/jobs/view/1",
        scrapeBundle,
        claimedBy: "desktop-a",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
  });

  it("returns null when there is no claimable scrape job", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => []),
    });

    await expect(client.claimNextScrapeJob()).resolves.toBeNull();
  });

  it("renews scrape claims with the desktop claim owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
    );
    const client = new DesktopApiClient({
      apiBaseUrl: "http://127.0.0.1:3000",
      claimedBy: "desktop-a",
      getCookies: vi.fn(async () => []),
    });

    await client.renewScrapeClaim("job-1");

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/job-applications/job-1/scraping/heartbeat",
      {
        body: JSON.stringify({ claimedBy: "desktop-a" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });

  it("throws a typed error from a coded API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "conflict",
              error: "Scrape claim is owned by another desktop client",
              owner: "desktop-b",
            }),
            { status: 409 },
          ),
      ),
    );
    const client = createClient();

    const error = await client.renewScrapeClaim("job-1").catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(DesktopApiError);
    expect(error).toMatchObject({
      code: "conflict",
      details: { owner: "desktop-b" },
      message: "Scrape claim is owned by another desktop client",
      status: 409,
    });
  });

  it("falls back safely when an error response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Service unavailable", { status: 503 })),
    );

    await expect(createClient().claimNextScrapeJob()).rejects.toMatchObject({
      code: undefined,
      message: "API request failed with status 503",
      status: 503,
    });
  });
});

function createClient(): DesktopApiClient {
  return new DesktopApiClient({
    apiBaseUrl: "http://127.0.0.1:3000",
    claimedBy: "desktop-a",
    getCookies: vi.fn(async () => []),
  });
}

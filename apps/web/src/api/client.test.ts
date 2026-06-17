import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildUrl, requestJson } from "./client";

describe("API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds proxied URLs with query parameters", () => {
    expect(
      buildUrl("/job-applications", {
        profileId: "profile-1",
        sortDirection: "desc",
        empty: "",
      }),
    ).toBe("/api/job-applications?profileId=profile-1&sortDirection=desc");
  });

  it("parses successful JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    await expect(requestJson<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/health", {
      body: undefined,
      headers: undefined,
      method: "GET",
    });
  });

  it("throws ApiError for non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Invalid query parameters" }), { status: 400 }),
      ),
    );

    await expect(requestJson("/job-applications")).rejects.toMatchObject({
      message: "Invalid query parameters",
      status: 400,
    } satisfies Partial<ApiError>);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildUrl, hasApiErrorCode, requestJson } from "./client";

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
      credentials: "include",
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

  it("classifies API failures by stable code instead of message text", () => {
    const error = new ApiError("Message wording is not part of the contract", 402, {
      code: "payment_required",
      requiredCredits: 1,
      availableCredits: 0,
    });

    expect(hasApiErrorCode(error, "payment_required")).toBe(true);
    expect(hasApiErrorCode(error, "conflict")).toBe(false);
    expect(hasApiErrorCode(new Error("payment_required"), "payment_required")).toBe(false);
  });
});

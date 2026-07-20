import { describe, expect, it, vi } from "vitest";
import { resolveAuthBaseUrl, resolveAuthClientTransport } from "./auth";

describe("resolveAuthBaseUrl", () => {
  it("appends the auth path to the API base url", () => {
    expect(resolveAuthBaseUrl("/api", "http://localhost:5173")).toBe(
      "http://localhost:5173/api/auth",
    );
  });

  it("appends the auth path to an absolute api url", () => {
    expect(resolveAuthBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/auth");
  });

  it("adapts the desktop custom scheme through the packaged API proxy", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const transport = resolveAuthClientTransport("/api", "link2cv://app", fetchImpl);

    expect(transport.baseURL).toBe("https://desktop-auth.link2cv.invalid/api/auth");
    await transport.customFetchImpl?.(`${transport.baseURL}/get-session?source=desktop`, {
      credentials: "include",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0].toString()).toBe(
      "link2cv://app/api/auth/get-session?source=desktop",
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({ credentials: "include" });
  });

  it("keeps standard web auth requests on their HTTP origin", () => {
    const transport = resolveAuthClientTransport("/api", "https://app.example.com");

    expect(transport).toEqual({ baseURL: "https://app.example.com/api/auth" });
  });
});

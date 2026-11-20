import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpRemoteImageFetcher } from "./http-remote-image.fetcher.js";

describe("HttpRemoteImageFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads an allowed LinkedIn image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(Buffer.from("logo"), {
            status: 200,
            headers: { "content-type": "image/png", "content-length": "4" },
          }),
      ),
    );

    const result = await new HttpRemoteImageFetcher().fetch(
      "https://media.licdn.com/dms/image/logo",
    );

    expect(result.contentType).toBe("image/png");
    expect(result.body.toString()).toBe("logo");
  });

  it("rejects non-LinkedIn hosts and oversized images", async () => {
    const fetcher = new HttpRemoteImageFetcher(3);

    await expect(fetcher.fetch("https://example.com/logo.png")).rejects.toThrow(
      "LinkedIn media host",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(Buffer.from("logo"), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    );

    await expect(fetcher.fetch("https://media.licdn.com/logo.png")).rejects.toThrow("5 MB limit");
  });

  it("rejects unsupported content types and HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    const fetcher = new HttpRemoteImageFetcher();

    await expect(fetcher.fetch("https://media.licdn.com/logo.png")).rejects.toThrow("status 404");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("svg", {
            status: 200,
            headers: { "content-type": "image/svg+xml" },
          }),
      ),
    );

    await expect(fetcher.fetch("https://media.licdn.com/logo.svg")).rejects.toThrow("Unsupported");
  });

  it("follows redirects that stay on a LinkedIn media host", async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      url.pathname === "/old"
        ? new Response(null, { status: 302, headers: { location: "/dms/image/logo" } })
        : new Response(Buffer.from("logo"), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HttpRemoteImageFetcher().fetch("https://media.licdn.com/old");

    expect(result.body.toString()).toBe("logo");
    expect(fetchMock.mock.calls.map(([url]) => url.href)).toEqual([
      "https://media.licdn.com/old",
      "https://media.licdn.com/dms/image/logo",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), { redirect: "manual" });
  });

  it.each([
    "http://169.254.169.254/latest/meta-data",
    "https://media.licdn.com.evil.example/x",
    "https://unknown.licdn.com/x",
    "https://media.licdn.com:8443/x",
  ])("rejects a redirect to %s without requesting it", async (location) => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 301, headers: { location } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new HttpRemoteImageFetcher().fetch("https://media.licdn.com/logo.png"),
    ).rejects.toThrow("redirect must remain on a LinkedIn media host");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 307, headers: { location: "/again" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new HttpRemoteImageFetcher().fetch("https://media.licdn.com/logo.png"),
    ).rejects.toThrow("too many redirects");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

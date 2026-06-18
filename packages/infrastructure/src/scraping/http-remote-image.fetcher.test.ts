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
});

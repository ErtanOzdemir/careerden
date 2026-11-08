import { describe, expect, it, vi } from "vitest";
import {
  buildProxiedApiUrl,
  createPackagedRendererProtocolHandler,
  packagedRendererContentSecurityPolicy,
  packagedRendererSchemeRegistration,
} from "./packaged-renderer-protocol.js";

describe("packaged renderer protocol", () => {
  it("serves bundled assets and falls back to index.html for browser routes", async () => {
    const fetchFile = vi.fn(async () => new Response("renderer"));
    const handler = createHandler({ fetchFile });

    const assetResponse = await handler(new Request("careerden://app/assets/index.js"));
    const documentResponse = await handler(
      new Request("careerden://app/applications/application-1?tab=timeline"),
    );

    expect(fetchFile.mock.calls[0]?.[0]).toMatch(/\/renderer\/assets\/index\.js$/);
    expect(fetchFile.mock.calls[1]?.[0]).toMatch(/\/renderer\/index\.html$/);
    expect(documentResponse.headers.get("Content-Security-Policy")).toBe(
      packagedRendererContentSecurityPolicy,
    );
    expect(assetResponse.headers.get("Content-Security-Policy")).toBe(
      packagedRendererContentSecurityPolicy,
    );
    expect(documentResponse.headers.get("Permissions-Policy")).toBe(
      "camera=(), display-capture=(), geolocation=(), microphone=()",
    );
    expect(documentResponse.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(documentResponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(packagedRendererContentSecurityPolicy).toContain("script-src 'self'");
    expect(packagedRendererContentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(packagedRendererContentSecurityPolicy).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(packagedRendererContentSecurityPolicy).toContain("frame-src 'self' https:");
    expect(packagedRendererContentSecurityPolicy).not.toContain("fonts.googleapis.com");
    expect(packagedRendererContentSecurityPolicy).not.toContain("fonts.gstatic.com");
    expect(packagedRendererSchemeRegistration).toMatchObject({
      scheme: "careerden",
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    });
  });

  it("rejects traversal, unknown hosts, and non-read methods for renderer assets", async () => {
    const fetchFile = vi.fn(async () => new Response("renderer"));
    const handler = createHandler({ fetchFile });

    const traversal = await handler(new Request("careerden://app/%2e%2e%2fprivate.txt"));
    const unknownHost = await handler(new Request("careerden://other/index.html"));
    const method = await handler(new Request("careerden://app/index.html", { method: "POST" }));

    expect(traversal.status).toBe(400);
    expect(unknownHost.status).toBe(404);
    expect(method.status).toBe(405);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it("proxies API requests with session credentials and a trusted upstream origin", async () => {
    let forwardedBody = "";
    const fetchApi = vi.fn(async (input: string, init?: RequestInit) => {
      // Electron's Session.fetch only supports Chromium's RequestInit fields. Reconstructing
      // the request here catches Node-only streaming options that Electron drops internally.
      const forwardedRequest = new Request(input, {
        body: init?.body,
        credentials: init?.credentials,
        headers: init?.headers,
        method: init?.method,
        redirect: init?.redirect,
        signal: init?.signal,
      });
      forwardedBody = await forwardedRequest.text();
      return Response.json({ ok: true });
    });
    const handler = createHandler({ fetchApi });
    const response = await handler(
      new Request("careerden://app/api/notifications/notification-1/read?source=desktop", {
        body: JSON.stringify({ read: true }),
        headers: {
          Cookie: "renderer-cookie=untrusted",
          "Content-Type": "application/json",
          Origin: "careerden://app",
        },
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchApi).toHaveBeenCalledOnce();
    expect(fetchApi.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/base/notifications/notification-1/read?source=desktop",
    );
    const init = fetchApi.mock.calls[0]?.[1];
    expect(init).toMatchObject({ credentials: "include", method: "PATCH", redirect: "follow" });
    expect(init?.body).toBeInstanceOf(ArrayBuffer);
    expect(new Headers(init?.headers).get("Origin")).toBe("https://api.example.com");
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
    expect(response.headers.has("Content-Security-Policy")).toBe(false);
    expect(forwardedBody).toBe('{"read":true}');
  });

  it("adds configured headers to proxied API requests and overrides renderer copies", async () => {
    const fetchApi = vi.fn(async () => Response.json({ ok: true }));
    const handler = createHandler({
      apiBaseUrl: "http://127.0.0.1:3010",
      apiRequestHeaders: { "x-careerden-local-token": "launch-token" },
      fetchApi,
    });

    await handler(
      new Request("careerden://app/api/profiles/me", {
        headers: { "x-careerden-local-token": "renderer-guess" },
      }),
    );

    const headers = new Headers(fetchApi.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-careerden-local-token")).toBe("launch-token");
  });

  it("aborts the upstream request when the renderer cancels a streamed response", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetchApi = vi.fn(async (_input: string, init?: RequestInit) => {
      upstreamSignal = init?.signal ?? undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: open\n\n"));
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    });
    const handler = createHandler({ fetchApi });

    const response = await handler(new Request("careerden://app/api/job-applications/stream"));
    const reader = response.body!.getReader();
    await expect(reader.read()).resolves.toMatchObject({ done: false });
    expect(upstreamSignal?.aborted).toBe(false);
    await reader.cancel("closed");

    expect(upstreamSignal?.aborted).toBe(true);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("aborts the upstream request when the renderer aborts before a response arrives", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetchApi = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>(() => {
          upstreamSignal = init?.signal ?? undefined;
        }),
    );
    const handler = createHandler({ fetchApi });
    const renderer = new AbortController();

    void handler(new Request("careerden://app/api/profiles/me", { signal: renderer.signal }));
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
    renderer.abort();

    expect(upstreamSignal?.aborted).toBe(true);
  });

  it("passes complete and empty upstream responses through unchanged", async () => {
    const handler = createHandler({
      fetchApi: vi.fn(async (input: string) =>
        input.endsWith("/empty")
          ? new Response(null, { status: 204 })
          : Response.json({ ok: true }, { status: 201 }),
      ),
    });

    const created = await handler(new Request("careerden://app/api/items"));
    const empty = await handler(new Request("careerden://app/api/empty"));

    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toEqual({ ok: true });
    expect(empty.status).toBe(204);
  });

  it("returns a safe gateway response when the upstream API is unavailable", async () => {
    const onError = vi.fn();
    const handler = createHandler({
      fetchApi: vi.fn(async () => {
        throw new Error("private upstream detail");
      }),
      onError,
    });

    const response = await handler(new Request("careerden://app/api/notifications"));

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Careerden API is unavailable");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("serves the renderer but no API when there is no backend to proxy to", async () => {
    const fetchApi = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPackagedRendererProtocolHandler({
      fetchApi,
      fetchFile: vi.fn(async () => new Response("renderer")),
      rendererDirectory: "/opt/careerden/renderer",
    });

    const api = await handler(new Request("careerden://app/api/profiles/me"));
    const page = await handler(new Request("careerden://app/recovery"));

    expect(api.status).toBe(503);
    expect(fetchApi).not.toHaveBeenCalled();
    expect(page.status).toBe(200);
    expect(page.headers.get("Content-Security-Policy")).toBe(packagedRendererContentSecurityPolicy);
  });

  it("preserves an API base path when constructing upstream URLs", () => {
    expect(
      buildProxiedApiUrl(
        "https://api.example.com/careerden/",
        new URL("careerden://app/api/health?check=true"),
      ),
    ).toBe("https://api.example.com/careerden/health?check=true");
  });
});

function createHandler(
  overrides: Partial<Parameters<typeof createPackagedRendererProtocolHandler>[0]> = {},
) {
  return createPackagedRendererProtocolHandler({
    apiBaseUrl: "https://api.example.com/base",
    fetchApi: vi.fn(async () => Response.json({ ok: true })),
    fetchFile: vi.fn(async () => new Response("renderer")),
    rendererDirectory: "/opt/careerden/renderer",
    ...overrides,
  });
}

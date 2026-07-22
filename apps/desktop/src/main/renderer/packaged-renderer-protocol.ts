import { extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDesktopApiBaseUrl } from "../desktop-runtime-config.js";

export const packagedRendererScheme = "careerden";
export const packagedRendererOrigin = `${packagedRendererScheme}://app`;
export const packagedRendererUrl = `${packagedRendererOrigin}/`;
export const packagedRendererSchemeRegistration = {
  scheme: packagedRendererScheme,
  privileges: {
    codeCache: true,
    corsEnabled: true,
    secure: true,
    standard: true,
    stream: true,
    supportFetchAPI: true,
  },
} as const;

type ProtocolFetch = (input: string, init?: RequestInit) => Promise<Response>;

type StreamingRequestInit = RequestInit & {
  duplex?: "half";
};

export function createPackagedRendererProtocolHandler(options: {
  apiBaseUrl: string;
  fetchApi: ProtocolFetch;
  fetchFile: ProtocolFetch;
  onError?: (error: unknown) => void;
  rendererDirectory: string;
}): (request: Request) => Promise<Response> {
  const apiBaseUrl = normalizeDesktopApiBaseUrl(options.apiBaseUrl);
  const rendererDirectory = resolve(options.rendererDirectory);

  return async (request) => {
    const requestUrl = new URL(request.url);

    if (requestUrl.protocol !== `${packagedRendererScheme}:` || requestUrl.hostname !== "app") {
      return textResponse("Not found", 404);
    }

    if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
      return proxyApiRequest(request, requestUrl, apiBaseUrl, options);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
        status: 405,
      });
    }

    const filePath = resolveRendererFile(rendererDirectory, requestUrl.pathname);
    if (!filePath) return textResponse("Invalid renderer path", 400);

    try {
      return await options.fetchFile(pathToFileURL(filePath).toString(), {
        method: request.method,
      });
    } catch (error) {
      options.onError?.(error);
      return textResponse("Renderer asset unavailable", 500);
    }
  };
}

export function buildProxiedApiUrl(apiBaseUrl: string, requestUrl: URL): string {
  const target = new URL(normalizeDesktopApiBaseUrl(apiBaseUrl));
  const upstreamPath = requestUrl.pathname.slice("/api".length) || "/";
  target.pathname = `${target.pathname.replace(/\/$/, "")}${upstreamPath}`;
  target.search = requestUrl.search;
  target.hash = "";
  return target.toString();
}

async function proxyApiRequest(
  request: Request,
  requestUrl: URL,
  apiBaseUrl: string,
  options: {
    fetchApi: ProtocolFetch;
    onError?: (error: unknown) => void;
  },
): Promise<Response> {
  const targetUrl = buildProxiedApiUrl(apiBaseUrl, requestUrl);
  const targetOrigin = new URL(targetUrl).origin;
  const headers = new Headers(request.headers);

  for (const header of [
    "connection",
    "content-length",
    "cookie",
    "host",
    "origin",
    "proxy-authorization",
    "referer",
    "transfer-encoding",
  ]) {
    headers.delete(header);
  }

  headers.set("Origin", targetOrigin);

  const init: StreamingRequestInit = {
    credentials: "include",
    headers,
    method: request.method,
    redirect: "follow",
    signal: request.signal,
  };

  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    return await options.fetchApi(targetUrl, init);
  } catch (error) {
    options.onError?.(error);
    return textResponse("Careerden API is unavailable", 502);
  }
}

function resolveRendererFile(rendererDirectory: string, pathname: string): string | null {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requestedPath =
    decodedPath === "/" || extname(decodedPath) === ""
      ? "index.html"
      : decodedPath.replace(/^\/+/, "");
  const filePath = resolve(rendererDirectory, requestedPath);
  const relativePath = relative(rendererDirectory, filePath);

  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status,
  });
}

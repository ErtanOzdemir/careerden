import { extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDesktopApiBaseUrl } from "../desktop-runtime-config.js";

export const packagedRendererScheme = "careerden";
export const packagedRendererOrigin = `${packagedRendererScheme}://app`;
export const packagedRendererUrl = `${packagedRendererOrigin}/`;
export const packagedRendererContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "frame-src 'self' https:",
  "form-action 'self'",
  "worker-src 'none'",
].join("; ");
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

export function createPackagedRendererProtocolHandler(options: {
  apiBaseUrl: string;
  // Added to every proxied API request, such as the local edition's backend token.
  apiRequestHeaders?: Record<string, string>;
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
      const response = await options.fetchFile(pathToFileURL(filePath).toString(), {
        method: request.method,
      });
      return withRendererSecurityHeaders(response);
    } catch (error) {
      options.onError?.(error);
      return textResponse("Renderer asset unavailable", 500);
    }
  };
}

function withRendererSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", packagedRendererContentSecurityPolicy);
  headers.set("Permissions-Policy", "camera=(), display-capture=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
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
    apiRequestHeaders?: Record<string, string>;
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
  for (const [name, value] of Object.entries(options.apiRequestHeaders ?? {})) {
    headers.set(name, value);
  }

  const init: RequestInit = {
    credentials: "include",
    headers,
    method: request.method,
    redirect: "follow",
    signal: request.signal,
  };

  try {
    if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
      init.body = await request.arrayBuffer();
    }

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

import { apiBaseUrl } from "./config";

type QueryValue = boolean | number | string | null | undefined;

interface RequestJsonOptions {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  query?: Record<string, QueryValue>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(path: string, options: RequestJsonOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, response.statusText), response.status, payload);
  }

  return payload as T;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${apiBaseUrl}${normalizedPath}`, origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  if (apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")) {
    return url.href;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback || "API request failed";
}

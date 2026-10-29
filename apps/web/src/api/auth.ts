import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { isLocalEdition } from "../edition.js";
import { apiBaseUrl } from "./config";

const desktopAuthTransportOrigin = "https://desktop-auth.careerden.invalid";
const authTransport = resolveAuthClientTransport(apiBaseUrl);

export const authClient = createAuthClient({
  baseURL: authTransport.baseURL,
  fetchOptions: authTransport.customFetchImpl
    ? { customFetchImpl: authTransport.customFetchImpl }
    : undefined,
  plugins: [emailOTPClient()],
});

const noAccountSession = {
  data: null,
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: async () => undefined,
};

// The local edition has no accounts; skip the session request instead of letting it fail.
export const useAccountSession: typeof authClient.useSession = isLocalEdition
  ? ((() => noAccountSession) as unknown as typeof authClient.useSession)
  : authClient.useSession;

export interface ConfirmAccountEmailChangeResult {
  otherSessionsRevoked: boolean;
  success: boolean;
}

export const accountEmailApi = {
  requestChange(input: { currentPassword: string; newEmail: string }) {
    return authClient.$fetch<{ success: boolean }>("/email-otp/request-email-change", {
      body: input,
      method: "POST",
    });
  },
  confirmChange(input: { newEmail: string; otp: string }) {
    return authClient.$fetch<ConfirmAccountEmailChangeResult>("/email-otp/change-email", {
      body: input,
      method: "POST",
    });
  },
};

export function resolveAuthClientTransport(
  baseUrl: string,
  origin = defaultOrigin(),
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): {
  baseURL: string;
  customFetchImpl?: typeof globalThis.fetch;
} {
  const authBaseUrl = resolveAuthBaseUrl(baseUrl, origin);
  const authUrl = new URL(authBaseUrl);

  if (authUrl.protocol === "http:" || authUrl.protocol === "https:") {
    return { baseURL: authBaseUrl };
  }

  if (!authUrl.host) {
    throw new Error("Desktop auth proxy URLs require a host-based renderer origin");
  }

  const rendererOrigin = `${authUrl.protocol}//${authUrl.host}`;
  const transportBaseUrl = new URL(
    `${authUrl.pathname}${authUrl.search}${authUrl.hash}`,
    desktopAuthTransportOrigin,
  ).toString();

  return {
    baseURL: normalizeBaseUrl(transportBaseUrl),
    customFetchImpl: createDesktopAuthProxyFetch(rendererOrigin, fetchImpl),
  };
}

export function resolveAuthBaseUrl(baseUrl: string, origin = defaultOrigin()): string {
  const trimmed = baseUrl.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return normalizeBaseUrl(`${trimmed}/auth`);
  }

  if (trimmed.startsWith("/")) {
    return normalizeBaseUrl(`${origin}${trimmed}/auth`);
  }

  return normalizeBaseUrl(`${origin}/${trimmed}/auth`);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function createDesktopAuthProxyFetch(
  rendererOrigin: string,
  fetchImpl: typeof globalThis.fetch,
): typeof globalThis.fetch {
  return (input, init) => {
    const requestUrl = new URL(input instanceof Request ? input.url : input.toString());

    if (requestUrl.origin !== desktopAuthTransportOrigin) {
      return fetchImpl(input, init);
    }

    const proxyUrl = new URL(
      `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`,
      `${rendererOrigin}/`,
    );
    const proxyInit = input instanceof Request ? copyRequestInit(input, init) : init;

    return fetchImpl(proxyUrl, proxyInit);
  };
}

function copyRequestInit(request: Request, overrides?: RequestInit): RequestInit {
  const method = overrides?.method ?? request.method;
  const canHaveBody = method !== "GET" && method !== "HEAD";

  return {
    body: canHaveBody ? request.body : undefined,
    cache: request.cache,
    credentials: request.credentials,
    headers: request.headers,
    integrity: request.integrity,
    keepalive: request.keepalive,
    method: request.method,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
    ...overrides,
  };
}

function defaultOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

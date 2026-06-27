import { createAuthClient } from "better-auth/react";
import { apiBaseUrl } from "./config";

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(apiBaseUrl),
});

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

function defaultOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

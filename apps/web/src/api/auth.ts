import { createAuthClient } from "better-auth/react";
import { apiBaseUrl } from "./config";

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  basePath: "/auth",
});

function resolveAuthBaseUrl(): string {
  if (apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")) {
    return apiBaseUrl;
  }

  return `${window.location.origin}${apiBaseUrl}`;
}

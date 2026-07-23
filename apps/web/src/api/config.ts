export function resolveApiBaseUrl(
  configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api",
): string {
  return normalizeApiBaseUrl(configuredBaseUrl);
}

function resolveDefaultProfileId(): string | undefined {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const profileId = params.get("profileId");
    if (profileId) {
      return profileId;
    }
  }
  return (import.meta.env.VITE_DEFAULT_PROFILE_ID as string | undefined)?.trim();
}

export const apiBaseUrl = resolveApiBaseUrl();

export const defaultProfileId = resolveDefaultProfileId();

export function requireDefaultProfileId(): string {
  if (!defaultProfileId) {
    throw new Error("VITE_DEFAULT_PROFILE_ID is required to load profile-scoped API data.");
  }

  return defaultProfileId;
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    const relativeUrl = new URL(trimmed, "https://renderer.careerden.invalid");
    assertApiUrlHasNoRequestComponents(relativeUrl);
    return relativeUrl.pathname === "/" ? "" : relativeUrl.pathname.replace(/\/$/, "");
  }

  let absoluteUrl: URL;
  try {
    absoluteUrl = new URL(trimmed);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an absolute HTTP(S) URL or an absolute path");
  }

  if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTP or HTTPS");
  }

  if (absoluteUrl.username || absoluteUrl.password) {
    throw new Error("VITE_API_BASE_URL must not contain credentials");
  }

  assertApiUrlHasNoRequestComponents(absoluteUrl);

  const pathname = absoluteUrl.pathname === "/" ? "" : absoluteUrl.pathname.replace(/\/$/, "");
  return `${absoluteUrl.origin}${pathname}`;
}

function assertApiUrlHasNoRequestComponents(url: URL): void {
  if (url.search || url.hash) {
    throw new Error("VITE_API_BASE_URL must not contain a query or fragment");
  }
}

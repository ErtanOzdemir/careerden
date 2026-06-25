function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const apiPort = params.get("apiPort");
    if (apiPort) {
      return `http://localhost:${apiPort}`;
    }
  }
  return normalizeBaseUrl((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api");
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

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.replace(/\/$/, "");
}

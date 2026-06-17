export const apiBaseUrl = normalizeBaseUrl(
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api",
);

export const defaultProfileId = (
  import.meta.env.VITE_DEFAULT_PROFILE_ID as string | undefined
)?.trim();

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

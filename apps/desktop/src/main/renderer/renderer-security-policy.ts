import type { Session } from "electron";

type PermissionSession = Pick<Session, "setPermissionCheckHandler" | "setPermissionRequestHandler">;

export function configureRendererPermissionPolicy(electronSession: PermissionSession): void {
  electronSession.setPermissionCheckHandler(() => false);
  electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

export function isAllowedRendererNavigation(
  requestedUrl: string,
  trustedRendererUrl: string,
): boolean {
  const requested = parseUrl(requestedUrl);
  const trusted = parseUrl(trustedRendererUrl);

  if (!requested || !trusted || hasCredentials(requested)) {
    return false;
  }

  if (trusted.protocol === "file:") {
    return requested.href === trusted.href;
  }

  return requested.protocol === trusted.protocol && requested.host === trusted.host;
}

export function getAllowedExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value !== value.trim() || containsForbiddenUrlCharacter(value)) {
    return undefined;
  }

  const url = parseUrl(value);
  if (!url || hasCredentials(url)) {
    return undefined;
  }

  if (url.protocol !== "https:" && url.protocol !== "mailto:") {
    return undefined;
  }

  return url.toString();
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function hasCredentials(url: URL): boolean {
  return Boolean(url.username || url.password);
}

function containsForbiddenUrlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

import type {
  RemoteImage,
  RemoteImageFetcher,
} from "../../domain/scraping/remote-image-fetcher.js";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 3;

export class HttpRemoteImageFetcher implements RemoteImageFetcher {
  constructor(private readonly maxBytes = 5 * 1024 * 1024) {}

  async fetch(url: string): Promise<RemoteImage> {
    const response = await fetchFollowingLinkedInRedirects(
      linkedInMediaUrl(url, "Company logo URL must use a LinkedIn media host"),
    );

    if (!response.ok) {
      throw new Error(`Company logo download failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !allowedContentTypes.has(contentType)) {
      throw new Error(`Unsupported company logo content type: ${contentType ?? "missing"}`);
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBytes) {
      throw new Error("Company logo exceeds the 5 MB limit");
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > this.maxBytes) {
      throw new Error("Company logo exceeds the 5 MB limit");
    }

    return { body, contentType };
  }
}

/**
 * Follows redirects by hand so every hop is checked before it is requested; `redirect: "follow"`
 * would reach a non-LinkedIn host before the final URL could be checked.
 */
async function fetchFollowingLinkedInRedirects(url: URL): Promise<Response> {
  let current = url;

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetch(current, { redirect: "manual" });
    const location = response.headers.get("location");
    if (!redirectStatuses.has(response.status) || !location) return response;

    await response.body?.cancel();
    if (redirects === maxRedirects) {
      throw new Error("Company logo download followed too many redirects");
    }
    current = linkedInMediaUrl(
      new URL(location, current).href,
      "Company logo redirect must remain on a LinkedIn media host",
    );
  }
}

/**
 * Rebuilds the URL behind a literal LinkedIn media origin, so the request host never comes from
 * the input; only the path and query do. Concatenation keeps a path such as `//evil.example/x` on
 * the LinkedIn host, where resolving it against a base URL would switch hosts.
 */
function linkedInMediaUrl(url: string, message: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password) {
    throw new Error(message);
  }

  const pathAndQuery = encodedPathAndQuery(parsed, message);
  switch (parsed.hostname) {
    case "media.licdn.com":
      return new URL(`https://media.licdn.com${pathAndQuery}`);
    case "static.licdn.com":
      return new URL(`https://static.licdn.com${pathAndQuery}`);
    default:
      throw new Error(message);
  }
}

/**
 * Re-encodes every path segment and query key and value, so no input character can end the path
 * early or start a new authority. CodeQL also recognizes `encodeURIComponent` as the sanitizer.
 */
function encodedPathAndQuery(url: URL, message: string): string {
  let path = "";
  let query = "";
  try {
    for (const segment of url.pathname.slice(1).split("/")) {
      path += `/${encodeURIComponent(decodeURIComponent(segment))}`;
    }
  } catch {
    // A malformed percent escape cannot be a LinkedIn media path.
    throw new Error(message);
  }
  for (const [key, value] of url.searchParams) {
    query += `${query ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
  return `${path}${query}`;
}

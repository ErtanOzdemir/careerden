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

/** LinkedIn serves company logos from these hosts; any other host is refused. */
const linkedInMediaOrigins = new Map([
  ["media.licdn.com", "https://media.licdn.com"],
  ["static.licdn.com", "https://static.licdn.com"],
]);

/**
 * Rebuilds the URL on a constant origin, so the request host never comes from the input; only the
 * path and query do.
 */
function linkedInMediaUrl(url: string, message: string): URL {
  const parsed = new URL(url);
  const origin = linkedInMediaOrigins.get(parsed.hostname);

  if (parsed.protocol !== "https:" || parsed.port || parsed.username || !origin) {
    throw new Error(message);
  }

  return new URL(`${parsed.pathname}${parsed.search}`, origin);
}

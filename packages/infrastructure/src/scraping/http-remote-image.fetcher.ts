import type { RemoteImage, RemoteImageFetcher } from "@careerden/domain";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class HttpRemoteImageFetcher implements RemoteImageFetcher {
  constructor(private readonly maxBytes = 5 * 1024 * 1024) {}

  async fetch(url: string): Promise<RemoteImage> {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "https:" ||
      !(parsed.hostname === "media.licdn.com" || parsed.hostname.endsWith(".licdn.com"))
    ) {
      throw new Error("Company logo URL must use a LinkedIn media host");
    }

    const response = await fetch(parsed, { redirect: "follow" });

    if (!response.ok) {
      throw new Error(`Company logo download failed with status ${response.status}`);
    }

    const finalUrl = new URL(response.url || parsed.href);
    if (
      finalUrl.protocol !== "https:" ||
      !(finalUrl.hostname === "media.licdn.com" || finalUrl.hostname.endsWith(".licdn.com"))
    ) {
      throw new Error("Company logo redirect must remain on a LinkedIn media host");
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

import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { pageMetadata } from "./metadata";

describe("public routing and metadata", () => {
  it("keeps onboarding out of the sitemap and blocks private routes", () => {
    const sitemapUrls = sitemap().map((entry) => entry.url);
    expect(sitemapUrls.some((url) => url.includes("/onboarding"))).toBe(false);
    expect(sitemapUrls.some((url) => url.endsWith("/download"))).toBe(true);
    expect(robots().rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allow: expect.arrayContaining(["/download"]),
          disallow: expect.arrayContaining(["/onboarding", "/applications", "/api/"]),
        }),
      ]),
    );
  });

  it("emits canonical, social, and noindex metadata", () => {
    const metadata = pageMetadata({
      title: "Guided Setup",
      description: "Setup",
      path: "/onboarding",
      index: false,
    });
    expect(metadata.alternates?.canonical).toContain("/onboarding");
    expect(metadata.title).toBe("Guided Setup | Link2CV");
    expect(metadata.openGraph).toMatchObject({ type: "website", title: "Guided Setup | Link2CV" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});

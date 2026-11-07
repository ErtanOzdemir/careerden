import { describe, expect, it } from "vitest";
import { metadata as rootMetadata } from "@/app/layout";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { pageMetadata } from "./metadata";
import { publicRoutes, siteUrl } from "./site";

describe("public routing and metadata", () => {
  it("lists every public route as an absolute URL and keeps onboarding out", () => {
    const entries = sitemap();
    const sitemapUrls = entries.map((entry) => entry.url);

    expect(sitemapUrls).toEqual(publicRoutes.map((route) => new URL(route, siteUrl).toString()));
    expect(sitemapUrls.some((url) => url.includes("/onboarding"))).toBe(false);
    expect(entries[0]).toMatchObject({ priority: 1, changeFrequency: "weekly" });
    expect(entries.find((entry) => entry.url.endsWith("/download"))).toMatchObject({
      priority: 0.8,
    });
  });

  it("allows public routes, blocks private routes, and points crawlers to the sitemap", () => {
    const result = robots();

    expect(result.rules).toEqual([
      expect.objectContaining({
        userAgent: "*",
        allow: expect.arrayContaining([...publicRoutes, "/llms.txt"]),
        disallow: expect.arrayContaining(["/onboarding", "/applications", "/api/"]),
      }),
    ]);
    expect(result.sitemap).toBe(new URL("/sitemap.xml", siteUrl).toString());
  });

  it("emits canonical, social, and noindex metadata", () => {
    const metadata = pageMetadata({
      title: "Guided Setup",
      description: "Setup",
      path: "/onboarding",
      index: false,
    });
    expect(metadata.alternates?.canonical).toContain("/onboarding");
    expect(metadata.title).toEqual({ absolute: "Guided Setup | Careerden" });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "en_US",
      title: "Guided Setup | Careerden",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("attaches the shared social image to nested pages", () => {
    const metadata = pageMetadata({ title: "Terms", description: "Terms", path: "/terms" });
    const image = expect.objectContaining({ url: "/opengraph-image", width: 1200, height: 630 });

    expect(metadata.openGraph).toMatchObject({ images: [image] });
    expect(metadata.twitter).toMatchObject({ images: [image] });
  });

  it("does not repeat the site name when a page is titled after it", () => {
    expect(pageMetadata({ title: "Careerden", description: "Home", path: "/" }).title).toEqual({
      absolute: "Careerden",
    });
  });

  it("sets site-wide defaults in the root layout", () => {
    expect(rootMetadata.metadataBase?.toString()).toBe(new URL(siteUrl).toString());
    expect(rootMetadata.title).toMatchObject({ template: "%s | Careerden" });
    // Pages own their robots directives, so the not-found page keeps Next.js's noindex alone.
    expect(rootMetadata.robots).toBeUndefined();
    expect(rootMetadata.openGraph).toMatchObject({ siteName: "Careerden", locale: "en_US" });
    expect(rootMetadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

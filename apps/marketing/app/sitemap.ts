import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog";
import { absoluteUrl, publicRoutes } from "@/lib/site";

type PublicRoute = (typeof publicRoutes)[number];

const routePriority: Partial<Record<PublicRoute, { priority: number; weekly: boolean }>> = {
  "/": { priority: 1, weekly: true },
  "/download": { priority: 0.8, weekly: true },
  "/blog": { priority: 0.6, weekly: true },
};

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = publicRoutes.map((route) => {
    const { priority, weekly } = routePriority[route] ?? { priority: 0.3, weekly: false };
    return {
      url: absoluteUrl(route),
      changeFrequency: weekly ? "weekly" : "monthly",
      priority,
    };
  });
  const posts: MetadataRoute.Sitemap = getBlogPosts().map((post) => ({
    url: absoluteUrl(post.path),
    lastModified: post.updatedAt ?? post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  return [...routes, ...posts];
}

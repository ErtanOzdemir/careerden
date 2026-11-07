import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "@/lib/site";

type PublicRoute = (typeof publicRoutes)[number];

const routePriority: Partial<Record<PublicRoute, { priority: number; weekly: boolean }>> = {
  "/": { priority: 1, weekly: true },
  "/download": { priority: 0.8, weekly: true },
};

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => {
    const { priority, weekly } = routePriority[route] ?? { priority: 0.3, weekly: false };
    return {
      url: absoluteUrl(route),
      changeFrequency: weekly ? "weekly" : "monthly",
      priority,
    };
  });
}

import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...publicRoutes, "/llms.txt", "/llms-full.txt"],
        disallow: [
          "/onboarding",
          "/api/",
          "/login",
          "/signup",
          "/applications",
          "/profile",
          "/settings",
          "/templates",
          "/support",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/download",
          "/privacy",
          "/cookies",
          "/terms",
          "/gdpr",
          "/data-deletion",
          "/llms.txt",
          "/llms-full.txt",
        ],
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
    host: absoluteUrl("/"),
  };
}

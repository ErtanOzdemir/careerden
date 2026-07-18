import type { Metadata } from "next";
import { absoluteUrl, siteName } from "./site";

export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const fullTitle = title === siteName ? siteName : `${title} | ${siteName}`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index, follow: index, googleBot: { index, follow: index } },
    openGraph: {
      type: "website",
      siteName,
      title: fullTitle,
      description,
      url: absoluteUrl(path),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

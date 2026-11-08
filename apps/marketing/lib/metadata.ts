import type { Metadata } from "next";
import { absoluteUrl, siteName } from "./site";

export const titleTemplate = `%s | ${siteName}`;

// Rendered by app/opengraph-image.tsx. Next.js attaches that file only to the root segment, so
// nested pages that set their own openGraph must reference it explicitly.
export const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Careerden — Job application tracker and CV creator",
  type: "image/png",
} as const;

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
  const fullTitle = title === siteName ? siteName : titleTemplate.replace("%s", title);
  return {
    // Absolute, so the root layout's title template is not applied a second time.
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index, follow: index, googleBot: { index, follow: index } },
    openGraph: {
      type: "website",
      siteName,
      locale: "en_US",
      title: fullTitle,
      description,
      url: absoluteUrl(path),
      images: [socialImage],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [socialImage] },
  };
}

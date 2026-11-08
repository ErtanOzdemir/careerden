import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { titleTemplate } from "@/lib/metadata";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import "./globals.css";
import "./native-previews.css";

const defaultTitle = `${siteName} — Desktop job application tracker and CV creator`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: defaultTitle, template: titleTemplate },
  description: siteDescription,
  category: "productivity",
  keywords: [
    "job application tracker",
    "CV creator",
    "cover letter creator",
    "job search",
    "desktop app",
    "open source",
  ],
  creator: siteName,
  publisher: siteName,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    siteName,
    locale: "en_US",
    title: defaultTitle,
    description: siteDescription,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: defaultTitle, description: siteDescription },
};

export const viewport: Viewport = { colorScheme: "light dark", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

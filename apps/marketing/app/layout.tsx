import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LegacyOnboardingCleanup } from "@/components/legacy-onboarding-cleanup";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteName, siteUrl } from "@/lib/site";
import "./globals.css";
import "./native-previews.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: "Link2CV — Desktop job application tracker and CV creator",
  description:
    "An open-source desktop job application tracker, CV creator, and cover letter creator for managing statuses, follow-ups, match insights, and editable documents.",
  category: "productivity",
};

export const viewport: Viewport = { colorScheme: "light dark", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LegacyOnboardingCleanup />
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

export const siteName = "Link2CV";
export const githubUrl = "https://github.com/ErtanOzdemir/link2cv";
export const desktopDownloadPlaceholderUrl = "/download#installer-coming-soon";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.link2cv.example";
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "[CONTACT EMAIL]";
export const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "[LEGAL COMPANY NAME]";
export const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "[REGISTERED ADDRESS]";

export const publicRoutes = [
  "/",
  "/download",
  "/privacy",
  "/cookies",
  "/terms",
  "/gdpr",
  "/data-deletion",
] as const;

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

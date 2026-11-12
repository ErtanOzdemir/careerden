export const siteName = "Careerden";
export const githubUrl = "https://github.com/ErtanOzdemir/careerden";

export const siteDescription =
  "An open-source desktop job application tracker, CV creator, and cover letter creator for managing statuses, follow-ups, match insights, and editable documents.";

// An empty value falls back too, so a blank build variable cannot produce invalid canonical URLs.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.careerden.example";
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "[CONTACT EMAIL]";
export const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "[LEGAL COMPANY NAME]";
export const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "[REGISTERED ADDRESS]";

// The legal pages are drafts awaiting owner and legal review (LEGAL_PLACEHOLDERS.md). While this
// is false they answer 404, nothing links to them, and crawlers are not pointed at them.
export const legalPagesEnabled: boolean = false;

export const legalRoutes = ["/privacy", "/cookies", "/terms", "/gdpr", "/data-deletion"] as const;

type PublicRoute = "/" | "/download" | (typeof legalRoutes)[number];

export const publicRoutes: readonly PublicRoute[] = [
  "/",
  "/download",
  ...(legalPagesEnabled ? legalRoutes : []),
];

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

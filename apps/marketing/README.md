# Careerden Marketing

The public Careerden marketing, product-education, policy, and crawler experience is a separate Next.js service. It does not import authenticated application code or access profile, template, job, or generated-document data.

## Run locally

From the repository root, run:

    pnpm dev:marketing

The service listens on http://localhost:3001. Production builds use:

    pnpm --filter @careerden/marketing build
    pnpm --filter @careerden/marketing start

## Runtime configuration

| Variable                    | Purpose                                                          | Development fallback          |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| NEXT_PUBLIC_SITE_URL        | Canonical marketing origin used by metadata, sitemap, and robots | https://www.careerden.example |
| NEXT_PUBLIC_CONTACT_EMAIL   | Public footer contact                                            | [CONTACT EMAIL]               |
| NEXT_PUBLIC_COMPANY_NAME    | Reserved legal-company value pending approved copy               | [LEGAL COMPANY NAME]          |
| NEXT_PUBLIC_COMPANY_ADDRESS | Reserved legal-address value pending approved copy               | [REGISTERED ADDRESS]          |

Set public environment variables before the Next.js build because Next.js inlines them into the static output.

## Routes

- / — public landing page, including the five-step product workflow at /#how-it-works
- /download — public desktop download preview with mock installer links
- /onboarding — legacy noindex route that redirects to /#how-it-works
- /privacy, /cookies, /terms, /gdpr, /data-deletion — public legal/data-rights drafts
- /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt — crawler resources

The landing page positions Careerden as an open-source desktop job application tracker with a profile-aware CV creator and cover letter creator. It explains the current setup and preparation workflow with five fictional, presentation-only product previews: enter profile data, upload DOCX templates for custom layouts, map template variables to profile data, capture a LinkedIn job through the connected desktop app, and review or edit the resulting tracked application and document pack. The current user-facing capture path imports LinkedIn jobs through the connected desktop app. Direct manual application entry from other sources is planned and is not currently exposed. The public experience does not collect or persist the displayed profile, template, job, or document data.

The public service does not link to browser-based login, signup, or authenticated application routes. Careerden is presented as a desktop-only product. The `/download` page reflects the configured macOS DMG, Windows NSIS, and Linux AppImage targets, while every installer action intentionally points to `/download#installer-coming-soon` until verified artifacts are published.

The landing page links directly to https://github.com/ErtanOzdemir/careerden and presents Careerden as an open-source project while keeping the current BSL 1.1 license disclosure visible. Confirm that anonymous visitors can access the repository before production deployment.

See [LEGAL_PLACEHOLDERS.md](./LEGAL_PLACEHOLDERS.md) before any production launch.

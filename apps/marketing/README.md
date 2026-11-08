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

## Browser security headers

`next.config.ts` applies the marketing-specific CSP, frame and content-type protections,
referrer and permissions policies, and production HSTS to every route. Keep the policy
limited to resources used by this public service; authenticated web or Electron resource
requirements belong to their own policies.

## Search metadata

- The root layout sets `metadataBase` from `NEXT_PUBLIC_SITE_URL`, a `%s | Careerden` title
  template, and site-wide Open Graph and Twitter card defaults. Pages build their own title,
  description, canonical URL, robots directives, and social metadata through `pageMetadata` in
  `lib/metadata.ts`; pass `index: false` for routes that must stay out of search results.
- `app/opengraph-image.tsx` renders the shared social image. Next.js attaches it only to the
  root segment, so `pageMetadata` references it explicitly for nested pages. `app/icon.svg` is
  the favicon.
- `lib/structured-data.ts` builds schema.org JSON-LD: `Organization` and `WebSite` on every
  page, `SoftwareApplication` on `/` and `/download`, and `FAQPage` from the landing-page FAQ.
  Render it through `components/json-ld.tsx`, which escapes HTML-significant characters. JSON-LD
  is a data block, so it needs no CSP change. Keep legal entity details out of it until the
  placeholders below are confirmed.
- New public routes belong in `publicRoutes` in `lib/site.ts`, which feeds both the sitemap and
  the robots allow list.

## Routes

- / — public landing page, including the five-step product workflow at /#how-it-works and current
  credit plans at /#pricing
- /download — public OS-aware desktop download page for the latest verified release
- /onboarding — legacy noindex route that redirects to /#how-it-works
- /privacy, /cookies, /terms, /gdpr, /data-deletion — public legal/data-rights drafts
- /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt — crawler resources

The landing page positions Careerden as an open-source desktop job application tracker with a profile-aware CV creator and cover letter creator. It explains the current setup and preparation workflow with five fictional, presentation-only product previews: enter profile data, upload DOCX templates for custom layouts, map template variables to profile data, capture a job, and review or edit the resulting tracked application and document pack. The authenticated product imports publicly available LinkedIn job data through the desktop app without connecting the user's LinkedIn account, and it also accepts manually pasted job and company details from any source. Its pricing section explains the 10-credit free UTC monthly allowance and the $10 USD monthly Creem subscription that grants 100 credits per confirmed paid period; taxes may be added at checkout. The public experience does not collect or persist the displayed profile, template, job, or document data.

The public service does not link to browser-based login, signup, or authenticated application routes. Careerden is presented as a desktop-only product. The `/download` page detects macOS, Windows, or Linux in the browser and promotes the matching installer from the latest verified release. When a platform has multiple architecture-specific installers, the page groups them under one platform and asks the visitor to choose instead of inferring hardware architecture from browser data. It also lists direct DMG, EXE, and AppImage links for visitors who need another platform.

The landing page links directly to https://github.com/ErtanOzdemir/careerden and presents Careerden as an open-source project under the GNU Affero General Public License v3.0. Confirm that anonymous visitors can access the repository before production deployment.

See [LEGAL_PLACEHOLDERS.md](./LEGAL_PLACEHOLDERS.md) before any production launch.

# Marketing and Legal Launch Placeholders

The public legal copy is a working product draft, not legal advice or a compliance guarantee. A qualified reviewer and the service owner must replace or confirm every bracketed placeholder before production launch.

## Owner and business details

- `NEXT_PUBLIC_SITE_URL`: canonical production marketing origin. The fallback `https://www.careerden.example` is deliberately non-production.
- `NEXT_PUBLIC_COMPANY_NAME`, legal entity type, registration number, jurisdiction, and registered address.
- `NEXT_PUBLIC_CONTACT_EMAIL`, privacy/data-rights contact, legal notice contact, support contact, and deletion-request channel.
- Product availability, eligible markets, minimum user age, account eligibility, and effective dates.
- Approval of the current $10 USD monthly product price and 100-credit paid-period scope, plus final
  taxes, renewals, trials, refunds, cancellation, and price-change terms.

## Privacy and data governance

- Controller/processor roles, EU/UK establishment or representative, and lead supervisory authority.
- Purpose-by-purpose lawful-basis matrix and legitimate-interest assessments.
- Complete subprocessor list: hosting, PostgreSQL, Redis/BullMQ, S3-compatible storage, rendering, AI providers/models, email/notification, support, logging, and security.
- Processing regions, international-transfer countries, adequacy decisions, SCCs, UK addendum, and supplementary safeguards.
- AI-provider model, region, request retention, abuse monitoring, and training/data-use settings.
- Retention schedule for accounts, profiles, raw scrapes, normalized records, generated/uploaded documents, object storage, queue data, logs, support records, request records, and backups.
- Verified security controls and incident/breach contacts; do not convert these into guarantees.
- Data-subject request intake, identity verification, authorized agents, response/export format, secure delivery, escalation, and statutory timing by market.
- Article 22 / solely automated decision-making assessment.
- Self-service export and deletion paths, recovery window, active-system deletion target, backup expiry, legal exceptions, and processor propagation.
- Privacy and terms change-notice method and notice period.

## Cookies, analytics, and marketing

- Production cookie/storage inventory with names, providers, purposes, domains, durations, and Secure/HttpOnly/SameSite attributes.
- Analytics, error monitoring, experimentation, embeds, advertising, or confirmation that each category is absent.
- Consent platform, geographic rules, consent-log retention, and preference-revocation behavior.
- Final Open Graph/site artwork and approved brand/trademark wording if the generated default is replaced.

## Terms and operational policy

- Accepted-use details, suspension/termination policy, notice and appeal process.
- Counsel-approved user-content license, generated-output ownership, warranty disclaimer, liability cap, indemnity, and mandatory consumer-law carve-outs.
- Governing law, venue, dispute resolution, service of notice, and language priority.
- LinkedIn and other third-party terms review for the production scraping workflow.

## Implementation limitations to resolve

- The public five-step workflow is a static, fictional product demonstration. It does not upload templates, create a backend profile, submit a job, or store onboarding progress.
- Automatic LinkedIn capture currently requires the desktop app and a connected LinkedIn session. Direct manual application entry from other sources is planned but is not exposed as a complete user-facing flow; do not market it as currently available until that flow is implemented and verified.
- Uploading and mapping DOCX templates is presented as the recommended custom-layout setup. Do not describe it as a technical prerequisite while the authenticated product also provides built-in layouts.
- The current authenticated review flow lets users edit generated content and apply changes with `Update pack`. Do not claim a separate AI-regeneration action until that capability is implemented and verified.
- The current authenticated settings UI does not expose a verified self-service account-deletion control. The deletion page must not claim one until implemented and tested.
- Confirm whether the production app and marketing service share a host. If they do, preserve crawler blocks for all authenticated routes and APIs.

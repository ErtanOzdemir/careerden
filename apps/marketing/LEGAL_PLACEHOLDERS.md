# Marketing and Legal Launch Placeholders

The public legal copy is a working product draft, not legal advice or a compliance guarantee. A qualified reviewer and the service owner must replace or confirm every bracketed placeholder before production launch.

## Owner and business details

- `NEXT_PUBLIC_SITE_URL`: canonical production marketing origin. The fallback `https://www.careerden.example` is deliberately non-production.
- `NEXT_PUBLIC_COMPANY_NAME`, legal entity type, registration number, jurisdiction, and registered address.
- `NEXT_PUBLIC_CONTACT_EMAIL`, privacy/data-rights contact, legal notice contact, support contact, and deletion-request channel.
- Product availability, eligible markets, minimum user age, account eligibility, and effective dates.
- Approval of the current $10 USD monthly product price and 100-credit paid-period scope, plus final
  taxes, renewals, trials, refunds, cancellation, and price-change terms.

## Privacy, cookies, data rights, and deletion

`/privacy` (with a Turkish KVKK notice), `/cookies`, `/gdpr`, and `/data-deletion` describe the
Unplugged edition and the website as they run today and no longer show the draft notice. Before
the legal pages go live:

- Set `NEXT_PUBLIC_COMPANY_NAME` to the controller's identity; the pages show
  `[LEGAL COMPANY NAME]` until then. `NEXT_PUBLIC_COMPANY_ADDRESS` is optional and shown only
  when set.
- Make the stated retention true: server request logs at most 30 days, Umami statistics at most
  24 months, emails at most two years after a conversation ends.
- Confirm the KVKK Article 9 transfer safeguards for OVH (Germany) and Google Workspace.
- Rewrite all four pages before the cloud edition opens to the public: accounts, server-side
  profiles and documents, server AI keys, Creem billing, Resend email, R2 storage, and account
  deletion are not covered.

## Marketing

- Final Open Graph/site artwork and approved brand/trademark wording if the generated default is replaced.

## Terms and operational policy

- Accepted-use details, suspension/termination policy, notice and appeal process.
- Counsel-approved user-content license, generated-output ownership, warranty disclaimer, liability cap, indemnity, and mandatory consumer-law carve-outs.
- Counsel review of the "AI-generated output" terms section (accuracy disclaimer, third-party posting content, and user responsibility for documents sent in their name), kept consistent with the in-app notice on generated documents.
- Governing law, venue, dispute resolution, service of notice, and language priority.
- LinkedIn and other third-party terms review for the production scraping workflow.

## Implementation limitations to resolve

- The public five-step workflow is a static, fictional product demonstration. It does not upload templates, create a backend profile, submit a job, or store onboarding progress.
- Automatic LinkedIn capture uses public guest responses through the desktop app and does not
  connect the user's LinkedIn account. Manual application entry accepts pasted job/company details
  and an optional company logo from other sources.
- Uploading and mapping DOCX templates is presented as the recommended custom-layout setup. Do not describe it as a technical prerequisite while the authenticated product also provides built-in layouts.
- The current authenticated review flow lets users edit generated content and apply changes with `Update pack`. Do not claim a separate AI-regeneration action until that capability is implemented and verified.
- The current authenticated settings UI does not expose a verified self-service account-deletion control. The deletion page must not claim one until implemented and tested.
- Confirm whether the production app and marketing service share a host. If they do, preserve crawler blocks for all authenticated routes and APIs.

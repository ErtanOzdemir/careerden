# API Reference

Every HTTP route the Careerden API exposes. Careerden Unplugged serves the same routes
from its embedded backend, without the auth, billing, and support routes — see
[architecture.md](architecture.md#two-editions-one-codebase).

The API listens on port 3000 by default. The Vite development server proxies `/api/*`
to the same routes after removing the `/api` prefix. Apart from `/health`, Better Auth
handlers, and the signature-protected Creem webhook, endpoints require an authenticated
session cookie and enforce profile ownership.
Unexpected failures return the stable `internal` code, the message `Internal server error`,
and a trace ID that can be used to correlate the response with redacted server logs.
API responses also enforce a non-rendering CSP, clickjacking/content-sniffing defenses,
a restrictive permissions policy, and production HSTS.

The Vite web build emits a CSP meta policy and a `dist/_headers` deployment file with
the full browser security-header set. Static hosting must apply that file (or configure
equivalent response headers at the edge); the meta policy alone cannot enforce HSTS,
permissions policy, or frame restrictions. The marketing service and packaged Electron
renderer enforce their separately tailored policies in their own runtimes.

## Health and Authentication

| Method | Path      | Description                                             |
| ------ | --------- | ------------------------------------------------------- |
| `GET`  | `/health` | API health check                                        |
| `*`    | `/auth/*` | Better Auth sign-up, sign-in, OTP, and session handlers |

## Billing

| Method | Path                      | Description                                                |
| ------ | ------------------------- | ---------------------------------------------------------- |
| `GET`  | `/billing/credits`        | Read the authenticated user's authoritative credit balance |
| `GET`  | `/billing/subscription`   | Read the authenticated user's current subscription state   |
| `POST` | `/billing/checkout`       | Create a Creem hosted-checkout link                        |
| `POST` | `/billing/portal`         | Create a Creem customer-portal link                        |
| `POST` | `/billing/webhooks/creem` | Receive raw, HMAC-verified subscription lifecycle events   |

Starting an explicit match analysis without an available credit returns HTTP `402` with
the code `payment_required`, plus `requiredCredits` and `availableCredits`. Automatic
analysis at zero credits preserves the scraped job and records an `insufficient_credits`
workflow reason instead of queueing AI work.

Configure the Creem dashboard webhook destination as
`https://<api-host>/billing/webhooks/creem` and use the matching signing secret for
`CREEM_WEBHOOK_SECRET`. Paid events grant credits exactly once. Scheduled cancellation,
final cancellation, past-due, expired, and subscription-update events synchronize the
provider-neutral subscription state; a cancellation does not expire an already-paid
credit lot before its recorded period end.

Bullstudio runs as a separate, opt-in Docker service and discovers Careerden's BullMQ queues
from Redis. Start it with:

```bash
docker compose --profile operations up -d bullstudio
```

Open <http://localhost:4000> and sign in with the hardcoded username `bullstudio` and
password `Careerden-Bullstudio-2026!`. The port binds to `127.0.0.1` by default; production
access should go through an authenticated HTTPS reverse proxy or private network.
Standalone Bullstudio can retry/remove jobs and pause/resume queues, so treat access as
privileged operations access rather than read-only monitoring. Because the credentials are
stored in `compose.yaml`, anyone with repository access can read them.

## Profiles

| Method         | Path            | Description                        |
| -------------- | --------------- | ---------------------------------- |
| `GET`, `PATCH` | `/profiles/me`  | Read or update the current profile |
| `POST`         | `/profiles`     | Create a profile                   |
| `GET`, `PATCH` | `/profiles/:id` | Read or update an owned profile    |

CV and cover-letter documents are always rendered from the predefined HTML templates in
`@careerden/contracts` (`html-template-registry.ts`); there is no upload step. A profile can
set `defaultCvTemplateId`/`defaultCoverLetterTemplateId` through `PATCH /profiles/:id`, and a
job application can override either per application via `applicationPackPreferences`.

## Job Applications

| Method                   | Path                                                   | Description                                        |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| `POST`, `GET`            | `/job-applications`                                    | Create or list applications                        |
| `POST`                   | `/job-applications/manual`                             | Create from pasted manual job details              |
| `GET`                    | `/job-applications/analytics`                          | Read profile-scoped dashboard stats                |
| `GET`                    | `/job-applications/stream`                             | Stream profile-scoped changes (SSE)                |
| `POST`                   | `/job-applications/from-scrape`                        | Create from an existing scrape                     |
| `GET`, `PATCH`, `DELETE` | `/job-applications/:id`                                | Read, update, or permanently delete an application |
| `PUT`, `DELETE`          | `/job-applications/:id/archive`                        | Archive or restore an application                  |
| `PUT`                    | `/job-applications/:id/status`                         | Advance processing status                          |
| `POST`                   | `/job-applications/:id/retry`                          | Retry failed processing                            |
| `POST`                   | `/job-applications/:id/analysis`                       | Queue match analysis                               |
| `POST`                   | `/job-applications/:id/application-pack/generations`   | Queue CV and cover-letter generation               |
| `GET`, `POST`            | `/job-applications/:id/events`                         | List or add timeline events                        |
| `GET`, `POST`            | `/job-applications/:id/contacts`                       | List or add contacts                               |
| `PATCH`, `DELETE`        | `/job-applications/:id/contacts/:contactId`            | Update or delete a contact                         |
| `GET`, `POST`            | `/job-applications/:id/follow-ups`                     | List or schedule follow-ups                        |
| `PATCH`, `DELETE`        | `/job-applications/:id/follow-ups/:followUpId`         | Update or delete a follow-up                       |
| `PUT`                    | `/job-applications/:id/document-content`               | Save editable document content                     |
| `POST`                   | `/job-applications/:id/documents/generate`             | Generate CV and cover-letter files                 |
| `GET`                    | `/job-applications/:id/documents/:documentId/download` | Create a signed download URL                       |
| `POST`                   | `/job-applications/:id/document-preview`               | Render on-screen HTML preview from draft content   |

Listing requires `profileId`. Supported filters include processing/application status,
archive state, company, role, role type, priority, tag, date range, and free-text search.
`archiveState` defaults to `active` and accepts `archived` for the dedicated archive view.
Pagination uses `page` and `pageSize` (default 20, maximum 100), with `sortBy` and
`sortDirection` for ordering; archived results may be sorted by `archivedAt`.

Archiving preserves the application's tracker stage, processing results, documents, contacts,
events, and follow-ups. Only stable applications can be archived. Archived applications are
read-only, excluded from dashboard metrics, global search, scraping, and reminder delivery, and
must be restored before processing or editing. Active and archived applications can both be
permanently deleted; restoring reschedules unsent follow-ups that are still in the future.

Manual creation uses `multipart/form-data`. It requires `profileId`, `companyName`, `roleTitle`,
and `jobDescription`; it optionally accepts `companyDescription`, `companyWebsiteUrl`,
`jobLocation`, `jobUrl`, JSON-encoded `applicationPackPreferences`, and a `companyLogo` PNG, JPEG,
or WebP file up to 5 MB. Manual applications transition directly to `scraped` and follow the
profile's automatic match-analysis preference.

The desktop scraping worker additionally uses these authenticated endpoints:

| Method | Path                                       | Purpose                    |
| ------ | ------------------------------------------ | -------------------------- |
| `POST` | `/job-applications/scraping/claim`         | Claim the next scrape job  |
| `PUT`  | `/job-applications/:id/scrape-data`        | Submit raw/normalized data |
| `POST` | `/job-applications/:id/scraping/heartbeat` | Renew a scrape claim       |
| `POST` | `/job-applications/:id/scraping/fail`      | Report a scrape failure    |
| `POST` | `/job-applications/:id/scraping/retry`     | Retry scraping             |

A scrape failure report takes `claimedBy`, a user-facing `reason`, and an optional `category`
from `scrapingFailureCategorySchema`. The category is returned as `scrapeFailureCategory` on the
application and decides how many automatic retries the scrape gets.

## Notifications

| Method  | Path                          | Description                       |
| ------- | ----------------------------- | --------------------------------- |
| `GET`   | `/notifications`              | List current-user notifications   |
| `GET`   | `/notifications/unread-count` | Count unread notifications        |
| `GET`   | `/notifications/stream`       | Stream notification changes (SSE) |
| `PATCH` | `/notifications/:id/read`     | Mark one notification read        |
| `PATCH` | `/notifications/read-all`     | Mark all notifications read       |

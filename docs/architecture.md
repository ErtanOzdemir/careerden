# Architecture

How a job posting becomes a tracked application with an analysis and documents, how the
same code ships as two editions, and why the local edition is built the way it is.
`AGENTS.md` is the short version of this document for coding agents.

## How It Works

```text
LinkedIn URL or manual entry
           |
           v
Authenticated API -> PostgreSQL + transactional outbox
           |
           +-> Electron claims scrape work -> guest HTTP fetch -> raw + normalized scrape data
           |
           +-> reserve credit -> BullMQ -> LLM worker -> validated match analysis
           |
           +-> BullMQ -> documents worker -> HTML template/PDF rendering -> S3-compatible storage
           |
           +-> follow-up schedule -> notifications worker -> in-app/optional email reminder
                                                        |
                                                        +-> Redis -> API SSE -> Electron native alert
```

LinkedIn scraping runs locally in an Electron utility process through public guest HTTP
responses and HTML parsing; it does not require a LinkedIn account. The desktop worker
claims queued work from the API, renews the claim while scraping, and submits both
normalized and raw results. The API persists workflow changes and outbox events transactionally.
The LLM, documents, and notifications workers consume BullMQ jobs independently from
the API.

Each authenticated account receives 10 free AI credits for the current UTC calendar
month. The grant is created idempotently after registration or on the next authenticated
credit access, expires at the start of the next UTC month, and is never duplicated within
the same month. `GET /billing/credits` returns the authenticated user's available and
reserved totals.

One logical match-analysis attempt reserves one credit in the same PostgreSQL transaction
that records the attempt and analysis outbox event. BullMQ retries retain that reservation.
The LLM worker consumes it only after validated analysis output is persisted; terminal
failure, deletion, supersession, or a 24-hour timeout releases it without a usage entry.

Creem provides hosted subscription checkout and customer billing management. Each
confirmed paid period creates one idempotent 100-credit grant that expires at the
provider-confirmed period end. The current recurring product is $10 USD per month before
applicable taxes. Scheduled and completed cancellations update subscription state without
revoking credits from an already-paid period.

The authenticated web shell shows available and reserved credits in the top bar. Settings
explains credit settlement, displays subscription state, and opens Creem checkout or the
customer portal. Credit state refreshes on focus and application changes, and temporarily
polls while work has an active reservation so worker settlement becomes visible without a
page reload. A coded `payment_required` response links the preserved scraped job back to
credit settings.

In development, Electron loads the Vite renderer and connects to the standalone API. A
packaged app instead serves the bundled renderer from `careerden://app` and proxies
same-origin `/api` requests to its build-time API URL, or to its embedded backend in
Careerden Unplugged. See the
[desktop runtime and release guide](../apps/desktop/README.md) for notification behavior,
automatic-update behavior, packaging, signing, checksums, and the manual release
checklist.

### Careerden Unplugged

The Unplugged edition runs the same API and use cases inside the app instead of on
Careerden's servers:

```text
React renderer at careerden://app
           |
           | /api/* through the custom-protocol proxy, which adds a per-launch token
           v
Local backend utility process on 127.0.0.1:<random port>
  same Express routes and use cases, without auth, billing, or support routes
  PGlite (embedded PostgreSQL) + files on disk
  in-process outbox runner -> match analysis, document generation, storage cleanup
  in-process reminder timers, restored from the database on every start
           |
           +-> Electron main process: PDF printing and the decrypted AI key, on request
           +-> AI provider chosen by the user, called directly from the device
```

There are no credits: every analysis runs on the user's own key. Analysis is not queued
while no provider key is configured, and the job shows an **Add API key** prompt instead.
Reminders that fell due while the app was closed are delivered on the next start when the
follow-up is at most seven days old.

Model ids come from a remotely updatable catalog rather than code: the main process fetches
`apps/desktop/ai-models.json` from the repository's default branch, falls back to the last
valid cached copy and then to defaults embedded in the build, and passes the provider's
recommended and fallback models with the selection. Every edition retries once with the next
model when a provider reports the model as not found or retired, and stores the model that
produced each analysis. See the
[desktop guide](../apps/desktop/README.md#ai-model-catalog) for the file format.

Job processing uses explicit states:

```text
queued -> scraping -> scraped -> analyzing -> review_ready -> generating_documents -> completed
```

Manual tracker entries can move directly into the stored scraped state without browser
scraping. Analysis can run automatically per profile preference or be requested from the
application detail page. Eligible processing states can transition to `failed`; the
failure reason and workflow event are preserved so retries remain explicit.

## Monorepo Layout

Careerden is a strict ESM TypeScript monorepo organized around clean architecture and
bounded contexts.

```text
careerden/
├── apps/
│   ├── api/                   Express transport, auth, SSE, and composition root
│   ├── desktop/               Electron renderer, native notifications, and local scraping
│   ├── documents-worker/      BullMQ application-pack rendering consumer
│   ├── llm-worker/            BullMQ match-analysis consumer
│   ├── notifications-worker/  BullMQ reminder consumer and outbox recovery
│   └── web/                   React application served by Vite
└── packages/
    ├── application/           Use cases, ownership checks, and workflow orchestration
    ├── config/                Shared environment loading and validation
    ├── contracts/             Shared DTOs and Zod schemas
    ├── domain/                Entities, policies, and provider/repository interfaces
    └── infrastructure/        PostgreSQL, Redis, AI, scraping, rendering, and storage adapters
```

Backend code uses the same bounded-context names across layers, primarily `profiles`,
`job-applications`, `scraping`, `matching`, `documents`, and `notifications`, with
supporting `persistence`, `queue`, and `storage` capabilities.

Dependencies point inward: apps compose packages, application code depends on domain
and contracts, and infrastructure implements domain interfaces. HTTP routes remain thin;
ownership checks and business workflows live in application use cases.

## Two Editions, One Codebase

The editions differ only in the adapters their composition roots choose. `createApiApp`
(`apps/api/src/api-app.ts`) wires every route and use case from injected adapters, and the
use cases that the workers run live in `packages/application`. Two composition roots then pick
the infrastructure:

| Concern        | Cloud: `createApiRuntime` and workers | Unplugged: `createLocalApiRuntime`               |
| -------------- | ------------------------------------- | ------------------------------------------------ |
| Database       | PostgreSQL                            | PGlite in the app's data folder                  |
| Files          | S3-compatible storage                 | Local disk with HMAC-signed, expiring links      |
| Background     | Outbox → BullMQ → worker processes    | In-process outbox runner                         |
| Realtime       | Redis pub/sub                         | In-memory change buses                           |
| Authentication | Better Auth sessions                  | Per-launch token on loopback, one local user     |
| Credits        | PostgreSQL credit ledger              | Same ledger behind an unmetered decorator        |
| AI             | Server key from the environment       | User key resolved on every call                  |
| PDF            | Playwright Chromium                   | Electron `printToPDF` without scripts or network |

A build-time `CAREERDEN_EDITION` (`cloud` or `local`) selects the desktop runtime, and
`VITE_CAREERDEN_EDITION` removes sign-in, billing, credits, and support from the Unplugged
renderer. New routes and use cases belong in the shared composition, so both editions get them.

## Architecture Decisions

- **One codebase instead of a fork.** Every feature, fix, and migration reaches both editions
  at once. The cost is a few edition checks in the composition roots, the desktop shell, and
  the renderer.
- **PGlite instead of SQLite.** PGlite is PostgreSQL compiled to WebAssembly, so the same Knex
  migrations, `jsonb` queries, and repositories run unchanged in both editions. SQLite would
  have meant a second SQL dialect for every query. The trade-off is about 38 MB of fixed
  PostgreSQL files in each local data folder.
- **An in-process outbox runner instead of an in-memory queue.** An outbox event is marked
  processed only after its handler finishes, so analysis or document generation interrupted by
  closing the app is retried on the next start. Retries, backoff, and dead-lettering match the
  BullMQ workers.
- **A utility process behind a loopback token.** The backend runs outside Electron's main
  process so database and AI work never block the window. It listens only on `127.0.0.1`, and
  only requests carrying the token that Electron generates for each launch are accepted.
- **Keys in the operating system's keychain.** AI keys are encrypted with Electron
  `safeStorage` and decrypted only in the main process, which hands the active key to the backend
  for each AI call; the renderer can save, test, switch, and remove keys but never read one
  back. Keys are never stored in plain
  files.
- **No Chromium cookie store in Unplugged.** The local edition reaches its backend with
  Node's `fetch`, because opening the encrypted cookie store would trigger a keychain prompt on
  every launch and the edition has no cookies to keep.
- **Backups as JSON per table, restored through migrations.** An Unplugged backup is a zip
  archive saved as `.careerden`, holding a manifest, one JSON file per table rendered by
  PostgreSQL's `json_agg`, and the stored files, instead of a copy of the PGlite directory. The JSON is readable outside the app and stays
  importable across releases: an import recreates the archive's schema by running migrations up to
  the one it names, loads the rows with `json_populate_recordset`, and then runs the remaining
  migrations, so older backups are upgraded exactly like an installed database. Archives from a
  newer schema are rejected. Imports are restored into a staging folder first, and the current data
  is exported to the `backups` folder beside it before the two are swapped, so a damaged archive
  or a failed import never touches the existing data. AI keys are not part of a backup; the user
  enters them again on the new device.
- **A recovery screen instead of a restart loop.** A database that cannot be opened or migrated
  fails the same way on every launch, so Unplugged shows a recovery screen for it rather than
  restarting: restore a snapshot, open the data folder, copy diagnostics, or quit. Data from a
  newer version is detected before migrating and asks for the latest release. Crashes after a
  successful start still relaunch the app, but only twice within two minutes.
- **Categorized scrape failures with a paste fallback.** LinkedIn changes its HTML and answers
  suspicious guest traffic with `999` or `429`, and a scraper fix only reaches users with a new
  release. Every scrape failure is therefore classified as `blocked`, `rate_limited`, `network`,
  `parse`, `empty_description`, `not_found`, `disabled`, or `unknown`. The categories and their
  reason codec live in `@careerden/contracts` (so the renderer can read them) and the
  classification rules in `@careerden/domain`. The category travels inside the failure reason,
  because only an error message crosses the scraping utility process boundary. Whatever the
  category, the application page offers the manual paste form, prefilled with the LinkedIn URL;
  a pasted posting is an ordinary manual application and enters the normal analysis flow. A
  LinkedIn import feature flag only has to set the add-job dialog's `linkedInImportEnabled`, or
  fail queued imports as `disabled`, to reuse the same flow. The category also sets the retry
  policy: `blocked` and `rate_limited` get one retry after 15 minutes and pause Unplugged's
  scheduled scraping for 10, failures a retry cannot fix fail at once, and the rest keep the
  three-attempt backoff.
  fail queued imports as `disabled`, to reuse the same flow.
- **A local log file instead of telemetry.** The main process is the only writer of
  `userData/logs/careerden.log`, which rotates at 5 MB and keeps at most five files. The local
  backend and scraping utility processes post structured entries to it over their parent ports,
  so rotation never races between processes. Every entry carries metadata only, such as event
  names, status codes, provider names, and trace IDs, and passes through the same redaction rules
  as the API's error logs plus the session token and API keys the main process holds.
- **One version for both editions.** A single `vX.Y.Z` tag builds both editions into one draft
  release. Distinct artifact names and updater channels (`latest*.yml` and `local*.yml`) keep
  each installation on its own edition.

## Tech Stack

| Area                | Technology                                                               |
| ------------------- | ------------------------------------------------------------------------ |
| Runtime             | Node.js 22                                                               |
| Language            | TypeScript 5.7, strict ESM, NodeNext resolution                          |
| Package management  | pnpm 9.15 and Turborepo 2.9                                              |
| Desktop             | Electron 43                                                              |
| Web                 | React 19, React Router 7, Vite 6, Tailwind CSS 4                         |
| Rich-text editing   | Tiptap 3                                                                 |
| API and validation  | Express 4 and Zod 3                                                      |
| Authentication      | Better Auth with email OTP verification                                  |
| Database            | PostgreSQL 16 via Knex 3 and `pg`; PGlite in Unplugged                   |
| Queues and realtime | Redis 7 and BullMQ 5; in-process in Unplugged                            |
| AI                  | Vercel AI SDK 6 with OpenAI, Gemini, DeepSeek, Anthropic, and OpenRouter |
| Scraping            | Public guest HTTP responses and HTML parsing                             |
| PDF                 | Playwright 1.60; Electron `printToPDF` in Unplugged                      |
| Documents           | Predefined HTML templates                                                |
| Storage             | AWS S3 SDK with RustFS locally and Cloudflare R2                         |
| Observability       | OpenTelemetry and OpenObserve                                            |
| Testing             | Vitest 2 and Testing Library                                             |
| Quality             | ESLint 10 and Prettier 3                                                 |

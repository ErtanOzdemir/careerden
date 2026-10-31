# Careerden Agent Guide

## Project Overview

Careerden is a TypeScript monorepo for turning imported LinkedIn or manually pasted job
postings into profile-aware CV and cover-letter documents. The app stores raw and normalized
job/company data, optionally runs AI matching/document generation, and renders documents for
review or download.

## Tech Stack

- Runtime: Node.js 22 (`.nvmrc`)
- Package manager: pnpm 9.15.0
- Language: TypeScript 5.7, strict mode, ESM, `moduleResolution: "NodeNext"`
- Monorepo orchestration: Turborepo 2.9
- Linting and formatting: ESLint 10, typescript-eslint 8.61, Prettier 3.8
- Testing: Vitest 2.1
- API: Express 4.21, Zod 3.24 for validation
- Desktop runtime: Electron 43 with a Vite renderer in development and a bundled custom
  protocol renderer in packaged builds
- Web app: React 19, React Router 7, Vite 6, Tailwind CSS 4, Tiptap 3
- Persistence: PostgreSQL via `pg` and Knex 3.1 for API database access and
  migrations
- Scraping: public LinkedIn guest HTTP responses and HTML parsing
- AI: Vercel AI SDK 6 with OpenAI, Gemini, DeepSeek, and Anthropic provider packages, plus
  OpenRouter through the OpenAI-compatible provider
- Document generation: predefined HTML templates rendered to on-screen preview and PDF via
  Playwright
- Storage: S3-compatible object storage via RustFS locally and Cloudflare R2 in production
  for generated files
- Email: SMTP through MailHog locally and the Resend HTTP API in production

## Naming Conventions

- Workspace packages use the `@careerden/*` scope.
- Backend and package source files use kebab-case names, for example
  `process-job-application.ts` and `bullmq-job-application.queue.ts`.
- Backend folders are named by bounded context, for example `job-applications`,
  `documents`, `matching`, `profiles`, `scraping`, `persistence`, `queue`, and `storage`.
- React components and pages use PascalCase filenames, for example `StatusBadge.tsx` and
  `ProfileManager.tsx`.
- Tests are colocated with the behavior they cover and use `*.test.ts` or `*.test.tsx`.
- Internal relative TypeScript imports include the runtime `.js` extension.
- Intentionally unused variables, arguments, or caught errors should be prefixed with `_`
  to satisfy the ESLint configuration.
- Keep package public imports stable through package exports/barrels; keep internal code
  organized by context.

## Architecture Decisions

- Keep clean architecture boundaries:
  - `packages/api` contains Express route wiring, request validation, and response mapping.
  - `packages/application` contains use cases and workflow orchestration.
  - `packages/domain` contains entities, workflow state, repository/provider interfaces,
    and domain services.
  - `packages/contracts` contains shared DTOs and Zod schemas.
  - `packages/infrastructure` contains database repositories, scrapers, AI clients,
    document renderers, queue implementations, and storage adapters.
  - `packages/config` contains environment loading and validation.
- `packages/*` holds only code shared by more than one app. Code used by a single app lives
  in that app under the same layers, for example
  `apps/api/src/{domain,application,infrastructure,contracts}/<bounded-context>/`. App-owned
  layers keep the same dependency direction and may depend on the shared packages, never the
  reverse. Shared application test doubles are exposed through `@careerden/application/testing`.
- Keep HTTP handlers thin. Put business rules in application/domain code, not routes.
- Organize backend source by bounded context inside each package. Do not reintroduce broad
  generic folders such as `entities`, `interfaces`, `schemas`, `routes`, or `use-cases`.
- Keep scraping behind site-specific adapters and factories. LinkedIn is one adapter, not
  a special case spread through the workflow.
- Preserve raw scrape payloads alongside normalized data for traceability.
- Keep AI providers, storage, template rendering, PDF rendering, and persistence behind
  interfaces/adapters so implementations can be swapped.
- Validate external inputs and AI output with schemas before persisting or rendering.
- Use explicit workflow status transitions for job applications.
- Job application archiving is orthogonal to tracker and processing status. Only stable
  `scraped` applications without queued analysis, `review_ready`, `completed`, or `failed`
  applications may be archived. Archived applications remain readable and downloadable but are
  excluded from active lists, analytics, scraping, and reminder delivery; restore them before any
  mutation or processing command other than permanent deletion. Active and archived applications
  may both be permanently deleted.
- Unexpected API exceptions return a fixed internal error message with a trace ID.
  Centralized logs record only redacted error fields and must not include request payloads,
  authentication data, credentials, or tokens.
- The desktop runtime loads the Vite web app in development, where Vite receives
  `VITE_API_BASE_URL` directly from the trusted development environment. Renderer query
  parameters never control the API destination. A packaged build serves bundled
  renderer assets from `careerden://app`, provides React Router fallback, and proxies
  same-origin `/api` requests to the build-time `DESKTOP_API_BASE_URL`. The API remains a
  standalone service.
- The desktop renderer uses context isolation and Chromium sandboxing without Node
  integration. Main-window navigation stays on the configured renderer authority,
  renderer permissions default to denied, and only validated `https:` or `mailto:`
  destinations may be opened through the operating system.
- Privileged desktop IPC handlers are registered through one sender policy that accepts
  only the active main window's main frame. Keep preload capabilities narrow and do not
  expose arbitrary application-path lookup to the renderer.
- Packaged renderer responses enforce the CSP and security headers defined by the custom
  protocol handler. Release packages disable Electron's RunAsNode, Node options/inspector,
  and extra file-protocol fuses while enabling cookie encryption, ASAR integrity
  validation, and ASAR-only application loading. Cookie encryption must not be disabled
  after release because the fuse transition is one-way.
- API, Vite web, Next.js marketing, and packaged Electron surfaces own separate,
  regression-tested CSP and security-header policies. Production HTTP surfaces enable
  HSTS; Vite builds emit `dist/_headers`, which the static host must apply.
- The desktop main process consumes the authenticated, profile-scoped notification SSE
  stream, with Electron's default session in the cloud edition and Node's fetch in the local
  edition. It refreshes the renderer and shows an operating-system notification for every new
  notification, including while the app is in front. Clicking the alert restores the app and
  opens the related timeline.
- The local edition never opens Chromium's cookie store, whose encryption key lives in the
  macOS Keychain: its renderer proxy, notification stream, and update policy requests use
  Node's fetch. The renderer proxy aborts upstream requests when the renderer cancels a
  response, so closed event streams do not exhaust the per-host connection limit.
- Desktop LinkedIn scraping uses public guest HTTP responses in an isolated utility
  process and does not require or persist a user's LinkedIn account session.
- The desktop app builds as two editions selected by `CAREERDEN_EDITION` (`cloud` or
  `local`) and `VITE_CAREERDEN_EDITION` for the renderer. Careerden Unplugged
  (`com.careerden.unplugged`) sends no data to a Careerden server: a utility process runs
  `@careerden/api-app/local` on loopback behind a per-launch token with embedded PGlite,
  on-disk file storage with signed links, in-memory change buses, and an in-process outbox
  runner instead of Redis and BullMQ workers. It has no accounts, billing, credits, email, or
  support routes, and its builds must not embed `DESKTOP_API_BASE_URL`.
- Local edition AI uses the user's own provider key, stored by the main process with
  `safeStorage` and never returned to the renderer. Analysis is not queued while no
  provider is configured. Electron prints its PDFs in a hidden window without scripts or
  network access. Reminders are restored from the database on start, delivering those up
  to seven days overdue.
- First-run onboarding is shared by both editions. `OnboardingGate` shows the setup wizard in
  place of the app shell until `user_profiles.onboarding_completed_at` is set, and fails open
  when the profile cannot be read. The server stamps onboarding timestamps through
  `PATCH /profiles/me/onboarding`. Only the local desktop edition shows the AI provider step.
  The dashboard setup checklist derives its items from profile, provider, and application data
  rather than storing them. Profiles that existed before onboarding are backfilled as complete.
- Shared composition lives in `createApiApp` (HTTP) and `packages/application` (use cases),
  so cloud and local runtimes differ only in the adapters they pass. Add routes and use
  cases there rather than in either runtime.
- The API runtime uses PostgreSQL for state, S3-compatible object storage through RustFS
  locally or Cloudflare R2 in production, and Redis/BullMQ for enqueueing job application
  processing.
- The API sends authentication and account emails through local SMTP outside production and
  Resend in production. The notifications worker uses the same provider selection when reminder
  email is enabled. Keep both behind the domain `EmailSender`; follow-up outbox retries pass their
  stable message ID to Resend as an idempotency key. Reminder email retries stop after 20 attempts
  or a 23-hour retry window, permanent provider failures dead-letter immediately, and dead-lettered
  outbox events retain redacted failure metadata without being claimed again.
- Backend `tsx watch` development scripts use Node's `development` export condition, and internal
  packages expose `src/index.ts` under that condition. Preserve this source-resolution path so
  shared-package edits restart consuming apps; normal builds and starts must keep using `dist`.
- The `apps/llm-worker`, `apps/documents-worker`, and `apps/notifications-worker`
  runtimes consume BullMQ work independently from the API process. Future workers should
  use the same descriptive `*-worker` app naming convention.
- Production API and worker images use the dedicated Dockerfiles in their owning
  `apps/*` directories, with the repository root as the build context. The API and
  documents-worker images install Playwright's matching Chromium headless shell and
  validate PDF rendering during the image build; other worker images do not install a
  browser.
- Each worker exposes loopback-only `/health/live` and `/health/ready` endpoints on its
  configured worker health port. Docker checks readiness, which requires an active,
  unpaused BullMQ worker plus working Redis and PostgreSQL connections; worker health
  ports must not be publicly exposed.
- On Coolify, the API, workers, and Redis Database Resource must share the same Server and
  Destination. Every runtime uses Redis's private Internal URL through `REDIS_URL`; never
  use the local `redis://localhost:6380` default from a production container.
- Desktop release tags must match the version in `apps/desktop/package.json`. The
  GitHub workflow builds platform installers and electron-updater metadata, validates
  `apps/desktop/release-policy.json`, generates SHA-256 checksums, and creates a draft
  release; publishing remains the manual gate that exposes an update to clients.
- Both editions are released from the same tag and draft release with distinct artifact names
  and updater channels: `latest*.yml` for Careerden and `local*.yml` for Careerden Unplugged.
- Packaged desktop builds check public GitHub Releases at startup, hourly, and on demand.
  Update discovery comes from electron-builder's platform `latest*.yml`; the separately
  published policy controls only `minimumSupportedVersion`. Private or unreachable
  release metadata fails open unless a cached policy already requires an update.
- Release builds embed `DESKTOP_UPDATE_REPOSITORY` in `owner/repository` form. The GitHub
  workflow derives it from the current repository so forks never default to upstream
  update metadata; packaged local builds without it keep the updater disabled.
- PostgreSQL migrations are run through Knex during API startup.
- Better Auth rate limits are stored in PostgreSQL and resolve client IPs through
  `AUTH_TRUSTED_PROXIES`. Email OTPs additionally use per-email counters keyed by an email
  hash: at most 5 codes per hour at least 90 seconds apart, and 10 verification attempts per
  hour across all codes, reset after a successful verification. Limited requests return 429
  with `X-Retry-After`, and the web resend controls show the matching cooldown.
- AI credits belong to the Better Auth user. Free access is granted as one idempotent
  10-credit lot per UTC calendar month; authenticated balance reads and analysis requests
  lazily recover a missing current-month grant.
- One logical match-analysis attempt uses one PostgreSQL-backed credit reservation shared
  by all BullMQ deliveries and retries. Consume it only in the transaction that persists
  validated analysis output. Terminal failure, deletion, supersession, and the LLM
  worker's 24-hour recovery scan release it without writing a usage ledger entry.
- Creem remains an infrastructure adapter behind provider-neutral application and domain
  billing interfaces. Its webhook route consumes the exact raw request body before global
  JSON and authentication middleware, verifies `creem-signature`, records provider events
  idempotently, and grants subscription-cycle credits only for confirmed paid events.
- The web Credits & billing page reads payment history live from the billing provider through
  the provider-neutral `BillingPaymentHistoryProvider` and credit activity from the local credit
  ledger. A provider failure only hides payment history; credit activity stays available.
- Scheduled or completed Creem cancellation updates subscription state but does not revoke
  a paid-period credit grant before its provider-confirmed expiration.
- The authenticated web shell owns credit and subscription reads through
  `CreditBalanceProvider`. It coalesces refreshes, retains the last successful balance on
  background failure, refreshes on focus and application SSE changes, and polls only while
  credits are reserved.
- Production startup fails closed when Better Auth or object-storage credentials use
  missing, short, or known development values; production object storage must not target
  localhost. The production API also requires `RESEND_API_KEY` and a valid, non-local
  `EMAIL_FROM`; the notifications worker requires them when `NOTIFICATION_EMAIL_ENABLED=true`.

## Runtime Validation Commands

- Start PostgreSQL, Redis, and RustFS, then every development target through Turbo:
  ```bash
  pnpm dev
  ```
- Start only the LLM worker:
  ```bash
  pnpm dev:llm-worker
  ```
- Start PostgreSQL, Redis, and RustFS and wait until they are ready:
  ```bash
  pnpm dev:services
  ```
- Start the API, workers, web dev server, and desktop app through Turbo; Electron waits for
  `http://localhost:3000/health` and `http://localhost:5173` before opening:
  ```bash
  pnpm dev:desktop
  ```
- Start the local edition web dev server and desktop app without Docker services:
  ```bash
  pnpm dev:desktop:local
  ```
- Check whether the Vite web dev server is listening:
  ```bash
  curl -I http://localhost:5173
  ```
- Check the proxied API health endpoint when using the Vite proxy:
  ```bash
  curl http://localhost:5173/api/health
  ```
- Build the desktop main process and production renderer against an explicit API:
  ```bash
  DESKTOP_API_BASE_URL=https://api.example.com \
    DESKTOP_UPDATE_REPOSITORY=owner/repository \
    CAREERDEN_REQUIRE_DESKTOP_API_BASE_URL=true \
    CAREERDEN_REQUIRE_DESKTOP_UPDATE_REPOSITORY=true \
    pnpm --filter @careerden/desktop build
  ```
- Package the already-built desktop app for the current host platform:
  ```bash
  pnpm --filter @careerden/desktop package
  ```
- Build and package the local edition for the current host platform:
  ```bash
  CAREERDEN_EDITION=local VITE_CAREERDEN_EDITION=local \
    pnpm --filter @careerden/desktop build
  pnpm --filter @careerden/desktop package:local
  ```
- Build the production API and worker images from the repository root:
  ```bash
  docker build -f apps/api/Dockerfile -t careerden-api .
  docker build -f apps/llm-worker/Dockerfile -t careerden-llm-worker .
  docker build -f apps/documents-worker/Dockerfile -t careerden-documents-worker .
  docker build -f apps/notifications-worker/Dockerfile -t careerden-notifications-worker .
  ```
- Verify local Playwright PDF rendering after installing Chromium:
  ```bash
  pnpm --filter @careerden/infrastructure smoke:playwright-pdf
  ```
- Find likely running app ports:
  ```bash
  lsof -nP -iTCP:5173 -sTCP:LISTEN
  lsof -nP -iTCP -sTCP:LISTEN | rg 'Electron|node|tsx|vite'
  ```

## Required Quality Gates

Run these commands before considering source changes ready:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
```

Run tests when behavior, contracts, persistence, queues, scraping, rendering, or AI
integration changes:

```bash
pnpm test
```

For docs-only changes, at minimum check the edited file and then run the repo formatting
and static verification gates:

```bash
pnpm exec prettier AGENTS.md --check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

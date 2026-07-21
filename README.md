# Careerden

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

Careerden is a desktop-first job application tracker that turns LinkedIn job postings into
profile-aware match analysis, tailored CVs, and cover letters. It combines local
Playwright scraping with an authenticated React app, durable PostgreSQL state, BullMQ
workers, editable document content, custom DOCX templates, and S3-compatible file
storage.

## Features

- Track applications manually or add a LinkedIn job URL for desktop scraping.
- Manage application stages, interest level, tags, salary range and type, work style,
  contacts, timeline events, and multiple follow-ups.
- Filter, sort, search, and paginate the application log, with dashboard analytics and
  real-time updates over server-sent events.
- Maintain a reusable profile with experience, education, projects, certifications,
  links, and analysis/reminder preferences.
- Analyze each role against the profile with OpenAI, Gemini, or DeepSeek and review
  matched, partial, and missing requirements.
- Edit AI-assisted CV and cover-letter content before generating files.
- Upload DOCX CV templates, map detected variables to profile/job fields, configure
  aliases, and select a default template.
- Generate custom DOCX CV and cover-letter files with PDF previews, or use the default
  PDF layouts, then download them through signed RustFS URLs.
- Receive in-app follow-up notifications and, when the desktop window is unfocused,
  native operating-system alerts with optional SMTP email delivery.
- Sign in with email and password using email OTP verification.

## Quick Start

### Prerequisites

- Node.js 22 (the version is pinned in `.nvmrc`)
- pnpm 9.15.0
- Docker with Docker Compose
- A Chromium browser installed for Playwright

### Setup

```bash
git clone git@github.com:ErtanOzdemir/careerden.git
cd careerden

nvm use
corepack enable
pnpm install
pnpm exec playwright install chromium

cp .env.example .env
docker compose up -d
```

Before starting the app, edit `.env`:

1. Set `OPEN_OBSERVE_KEY` to a non-empty OpenObserve Basic Auth credential. The API
   validates this value during startup; the local OpenObserve UI is available at
   <http://localhost:5080> after Docker Compose starts.
2. Set the API key for the selected `AI_PROVIDER` if you want to run match analysis and
   produce AI-assisted document guidance. The tracker can still be used without running
   AI jobs.
3. Replace the development auth and LinkedIn session secrets before using the app
   outside local development.

Start the complete desktop development stack:

```bash
pnpm dev:desktop
```

The command starts the API, React/Vite web app, LLM worker, documents worker,
notifications worker, and Electron desktop app. On first use, create an account and open MailHog at
<http://localhost:8025> to read the verification OTP. Connect a LinkedIn session from
the desktop app before submitting LinkedIn URLs for authenticated scraping.

The example environment also enables follow-up reminder email delivery, so those messages appear in
the same MailHog inbox. Keep `NOTIFICATION_EMAIL_ENABLED=false` in environments where reminder
emails should not be dispatched.

### Local Services

| Service        | Address                        | Purpose                              |
| -------------- | ------------------------------ | ------------------------------------ |
| Web app        | <http://localhost:5173>        | Vite development server              |
| API            | <http://localhost:3000>        | Express API                          |
| API health     | <http://localhost:3000/health> | Runtime health check                 |
| PostgreSQL     | `localhost:5432`               | Application and authentication state |
| Redis          | `localhost:6380`               | BullMQ and real-time change delivery |
| MailHog        | <http://localhost:8025>        | Development email inbox              |
| Gotenberg      | <http://localhost:3002>        | Containerized DOCX-to-PDF conversion |
| RustFS API     | <http://localhost:9000>        | S3-compatible object storage         |
| RustFS console | <http://localhost:9001>        | Object-storage administration        |
| OpenObserve    | <http://localhost:5080>        | OpenTelemetry trace collection       |

Gotenberg is bound to the host loopback interface for local development. If an API or
documents-worker runtime is moved into the same Compose network, set `GOTENBERG_URL` to
`http://gotenberg:3000` for that container.

The Vite proxy also exposes the health check at <http://localhost:5173/api/health>.

## How It Works

```text
LinkedIn URL or manual entry
           |
           v
Authenticated API -> PostgreSQL + transactional outbox
           |
           +-> Electron claims scrape work -> Playwright -> raw + normalized scrape data
           |
           +-> BullMQ -> LLM worker -> validated match analysis
           |
           +-> BullMQ -> documents worker -> DOCX/PDF rendering -> RustFS
           |
           +-> follow-up schedule -> notifications worker -> in-app/optional email reminder
                                                        |
                                                        +-> Redis -> API SSE -> Electron native alert
```

LinkedIn scraping runs locally in an Electron utility process. The desktop worker claims
queued work from the API, renews the claim while scraping, and submits both normalized
and raw results. The API persists workflow changes and outbox events transactionally.
The LLM, documents, and notifications workers consume BullMQ jobs independently from
the API.

In development, Electron loads the Vite renderer and connects to the standalone API. A
packaged app instead serves the bundled renderer from `careerden://app` and proxies
same-origin `/api` requests to its build-time API URL. See the
[desktop runtime and release guide](apps/desktop/README.md) for notification behavior,
packaging, signing, checksums, and the manual release checklist.

Job processing uses explicit states:

```text
queued -> scraping -> scraped -> analyzing -> review_ready -> generating_documents -> completed
```

Manual tracker entries can move directly into the stored scraped state without browser
scraping. Analysis can run automatically per profile preference or be requested from the
application detail page. Eligible processing states can transition to `failed`; the
failure reason and workflow event are preserved so retries remain explicit.

## Architecture

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

### Tech Stack

| Area                | Technology                                       |
| ------------------- | ------------------------------------------------ |
| Runtime             | Node.js 22                                       |
| Language            | TypeScript 5.7, strict ESM, NodeNext resolution  |
| Package management  | pnpm 9.15 and Turborepo 2.3                      |
| Desktop             | Electron 43                                      |
| Web                 | React 19, React Router 7, Vite 6, Tailwind CSS 4 |
| Rich-text editing   | Tiptap 3                                         |
| API and validation  | Express 4 and Zod 3                              |
| Authentication      | Better Auth with email OTP verification          |
| Database            | PostgreSQL 16 via Knex 3 and `pg`                |
| Queues and realtime | Redis 7 and BullMQ 5                             |
| AI                  | Vercel AI SDK 6 with OpenAI, Gemini, DeepSeek    |
| Scraping and PDF    | Playwright 1.49                                  |
| Documents           | HTML templates, Docxtemplater, Gotenberg         |
| Storage             | RustFS through the AWS S3 SDK                    |
| Observability       | OpenTelemetry and OpenObserve                    |
| Testing             | Vitest 2 and Testing Library                     |
| Quality             | ESLint 10 and Prettier 3                         |

## Environment Variables

Copy `.env.example` to `.env`. Runtime schemas provide the defaults shown below unless
the variable is marked required.

### API, Auth, and Frontend

| Variable               | Description                                              | Default                  |
| ---------------------- | -------------------------------------------------------- | ------------------------ |
| `NODE_ENV`             | `development`, `test`, or `production`                   | `development`            |
| `PORT`                 | API port                                                 | `3000`                   |
| `DATABASE_URL`         | PostgreSQL connection string                             | Required                 |
| `REDIS_URL`            | Redis connection string                                  | `redis://localhost:6380` |
| `BETTER_AUTH_SECRET`   | Better Auth signing secret, minimum 16 characters        | Development-only value   |
| `BETTER_AUTH_URL`      | Public API/auth base URL                                 | `http://localhost:3000`  |
| `WEB_ORIGIN`           | Allowed credentialed web origin                          | `http://localhost:5173`  |
| `VITE_API_BASE_URL`    | API URL used by the web and development desktop renderer | `http://localhost:3000`  |
| `DESKTOP_API_BASE_URL` | API URL embedded in a production desktop build           | `http://localhost:3000`  |

### Queue Operations Dashboard

| Variable                   | Description                            | Default |
| -------------------------- | -------------------------------------- | ------- |
| `BULLSTUDIO_PORT`          | Host port for the Bullstudio dashboard | `4000`  |
| `BULLSTUDIO_POLL_INTERVAL` | Redis polling interval in milliseconds | `5000`  |

### AI and Workers

| Variable                           | Description                        | Default                 |
| ---------------------------------- | ---------------------------------- | ----------------------- |
| `AI_PROVIDER`                      | `openai`, `gemini`, or `deepseek`  | `openai`                |
| `OPENAI_API_KEY`                   | OpenAI API key                     | —                       |
| `GEMINI_API_KEY`                   | Google Gemini API key              | —                       |
| `DEEPSEEK_API_KEY`                 | DeepSeek API key                   | —                       |
| `LLM_WORKER_CONCURRENCY`           | Parallel match-analysis jobs       | `1`                     |
| `DOCUMENTS_WORKER_CONCURRENCY`     | Parallel application-pack jobs     | `1`                     |
| `NOTIFICATIONS_WORKER_CONCURRENCY` | Parallel follow-up reminder jobs   | `1`                     |
| `NOTIFICATION_EMAIL_ENABLED`       | Send reminder emails through SMTP  | `false`                 |
| `GOTENBERG_URL`                    | DOCX-to-PDF conversion service URL | `http://localhost:3002` |

### Email, Storage, Scraping, and Tracing

| Variable                       | Description                                 | Default                                |
| ------------------------------ | ------------------------------------------- | -------------------------------------- |
| `SMTP_HOST`                    | SMTP server host                            | `localhost`                            |
| `SMTP_PORT`                    | SMTP server port                            | `1025`                                 |
| `SMTP_FROM`                    | Sender used for OTP and reminder emails     | `Careerden <no-reply@careerden.local>` |
| `LINKEDIN_SESSION_SECRET`      | Encrypts the local LinkedIn browser session | Development-only value                 |
| `LINKEDIN_SESSION_STORAGE_DIR` | Shared-config session storage path          | `./storage/linkedin-session`           |
| `RUSTFS_ENDPOINT`              | S3-compatible storage endpoint              | `http://localhost:9000`                |
| `RUSTFS_BUCKET`                | Generated file/template bucket              | `careerden`                            |
| `RUSTFS_ACCESS_KEY_ID`         | RustFS access key                           | `rustfsadmin`                          |
| `RUSTFS_SECRET_ACCESS_KEY`     | RustFS secret key                           | `rustfsadmin`                          |
| `RUSTFS_REGION`                | S3 region                                   | `us-east-1`                            |
| `RUSTFS_FORCE_PATH_STYLE`      | Use S3 path-style addressing                | `true`                                 |
| `OPEN_OBSERVE_URL`             | OpenTelemetry HTTP trace endpoint           | `http://localhost:5080`                |
| `OPEN_OBSERVE_KEY`             | OpenObserve Basic Auth credential           | Required                               |

## API Overview

The API listens on port 3000 by default. The Vite development server proxies `/api/*`
to the same routes after removing the `/api` prefix. Apart from `/health` and Better Auth
handlers, endpoints require an authenticated session cookie and enforce profile ownership.

### Health and Authentication

| Method | Path      | Description                                             |
| ------ | --------- | ------------------------------------------------------- |
| `GET`  | `/health` | API health check                                        |
| `*`    | `/auth/*` | Better Auth sign-up, sign-in, OTP, and session handlers |

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

### Profiles and Templates

| Method         | Path                                                            | Description                        |
| -------------- | --------------------------------------------------------------- | ---------------------------------- |
| `GET`, `PATCH` | `/profiles/me`                                                  | Read or update the current profile |
| `POST`         | `/profiles`                                                     | Create a profile                   |
| `GET`, `PATCH` | `/profiles/:id`                                                 | Read or update an owned profile    |
| `GET`, `POST`  | `/profiles/:id/document-templates`                              | List or upload DOCX CV templates   |
| `PATCH`        | `/profiles/:id/document-templates/:templateId/mappings`         | Update placeholder field mappings  |
| `PATCH`        | `/profiles/:id/document-templates/:templateId/variable-aliases` | Update template aliases            |
| `PATCH`        | `/profiles/:id/document-templates/:templateId/default`          | Select the default template        |

DOCX uploads use `multipart/form-data`, accept a `file` field, and are limited to 5 MB.

### Job Applications

| Method                   | Path                                                   | Description                            |
| ------------------------ | ------------------------------------------------------ | -------------------------------------- |
| `POST`, `GET`            | `/job-applications`                                    | Create or list applications            |
| `GET`                    | `/job-applications/analytics`                          | Read profile-scoped dashboard stats    |
| `GET`                    | `/job-applications/stream`                             | Stream profile-scoped changes (SSE)    |
| `POST`                   | `/job-applications/from-scrape`                        | Create from an existing scrape         |
| `GET`, `PATCH`, `DELETE` | `/job-applications/:id`                                | Read, update, or delete an application |
| `PUT`                    | `/job-applications/:id/status`                         | Advance processing status              |
| `POST`                   | `/job-applications/:id/retry`                          | Retry failed processing                |
| `POST`                   | `/job-applications/:id/analysis`                       | Queue match analysis                   |
| `POST`                   | `/job-applications/:id/application-pack/generations`   | Queue CV and cover-letter generation   |
| `GET`, `POST`            | `/job-applications/:id/events`                         | List or add timeline events            |
| `GET`, `POST`            | `/job-applications/:id/contacts`                       | List or add contacts                   |
| `PATCH`, `DELETE`        | `/job-applications/:id/contacts/:contactId`            | Update or delete a contact             |
| `GET`, `POST`            | `/job-applications/:id/follow-ups`                     | List or schedule follow-ups            |
| `PATCH`, `DELETE`        | `/job-applications/:id/follow-ups/:followUpId`         | Update or delete a follow-up           |
| `PUT`                    | `/job-applications/:id/document-content`               | Save editable document content         |
| `POST`                   | `/job-applications/:id/documents/generate`             | Generate CV and cover-letter files     |
| `GET`                    | `/job-applications/:id/documents/:documentId/download` | Create a signed download URL           |

Listing requires `profileId`. Supported filters include processing/application status,
company, role, role type, priority, tag, date range, and free-text search. Pagination uses
`page` and `pageSize` (default 20, maximum 100), with `sortBy` and `sortDirection` for
ordering.

The desktop scraping worker additionally uses these authenticated endpoints:

| Method | Path                                       | Purpose                    |
| ------ | ------------------------------------------ | -------------------------- |
| `POST` | `/job-applications/scraping/claim`         | Claim the next scrape job  |
| `PUT`  | `/job-applications/:id/scrape-data`        | Submit raw/normalized data |
| `POST` | `/job-applications/:id/scraping/heartbeat` | Renew a scrape claim       |
| `POST` | `/job-applications/:id/scraping/fail`      | Report a scrape failure    |
| `POST` | `/job-applications/:id/scraping/retry`     | Retry scraping             |

LinkedIn login/session actions are exposed to the React renderer through Electron IPC;
they are not part of the mounted HTTP API.

### Notifications

| Method  | Path                          | Description                       |
| ------- | ----------------------------- | --------------------------------- |
| `GET`   | `/notifications`              | List current-user notifications   |
| `GET`   | `/notifications/unread-count` | Count unread notifications        |
| `GET`   | `/notifications/stream`       | Stream notification changes (SSE) |
| `PATCH` | `/notifications/:id/read`     | Mark one notification read        |
| `PATCH` | `/notifications/read-all`     | Mark all notifications read       |

## Development

### Common Commands

| Command                                    | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `pnpm dev`                                 | Start every workspace development target through Turbo  |
| `pnpm dev:desktop`                         | Start API, web, all workers, and Electron with dev URLs |
| `pnpm dev:services`                        | Start PostgreSQL, Redis, RustFS, and Gotenberg          |
| `pnpm dev:api`                             | Start only the API                                      |
| `pnpm dev:llm-worker`                      | Start only the LLM worker                               |
| `pnpm dev:documents-worker`                | Start only the documents worker                         |
| `pnpm dev:notifications-worker`            | Start only the notifications worker                     |
| `pnpm --filter @careerden/web dev`         | Start only the Vite web app                             |
| `pnpm --filter @careerden/desktop build`   | Build the Electron main process and renderer            |
| `pnpm --filter @careerden/desktop package` | Package desktop for the current host platform           |
| `pnpm build`                               | Build every workspace                                   |
| `pnpm test`                                | Run all Vitest suites                                   |
| `pnpm lint`                                | Run ESLint                                              |
| `pnpm format:check`                        | Check Prettier formatting                               |
| `pnpm typecheck`                           | Type-check every workspace                              |
| `pnpm lint:fix` / `pnpm format`            | Apply mechanical lint/format fixes                      |

Use `docker compose up -d` instead of `pnpm dev:services` when local OTP email and
OpenObserve are also needed.

Desktop installers are produced by the tag-triggered GitHub Actions workflow as a draft
release. Publishing remains a manual verification step. Follow the complete
[desktop release checklist](apps/desktop/README.md#draft-release-workflow) before tagging
or publishing a version.

### Database Migrations

PostgreSQL migrations run automatically during API startup. They can also be managed
from the repository root:

```bash
pnpm migrate:status
pnpm migrate:latest
pnpm migrate:rollback
pnpm migrate:make <migration-name>
```

Additional one-step controls are available as `pnpm migrate:up` and
`pnpm migrate:down`.

### Testing and Quality Gates

```bash
# All tests
pnpm test

# One workspace
pnpm --filter @careerden/domain test

# Required source-change gates
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Tests are colocated with their behavior as `*.test.ts` or `*.test.tsx`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code conventions,
and pull request checklist. Security issues should follow [SECURITY.md](SECURITY.md).

## License

Careerden is licensed under the [Business Source License 1.1](LICENSE).

- Personal, non-commercial use: free
- Education and research: free
- Testing and contribution: free
- Commercial use: requires a commercial license

The license converts to [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
on **2036-06-13** (or four years after the first public release of each version,
whichever comes first).

For commercial licensing inquiries, contact mail@ozdemirertan.com.

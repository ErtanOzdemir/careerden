<div align="center">
  <img src="./apps/desktop/build/icon.png" alt="Careerden logo" width="112" />
  <h1>Careerden</h1>

<strong>Open-source desktop job application tracker and profile-aware CV and cover-letter creator.</strong>
<br />
Import LinkedIn jobs or paste any posting manually. Match your profile. Create tailored documents.
<br />
Use the Careerden cloud service, or keep everything on your device with Careerden Unplugged.
<br /><br />

  <a href="https://github.com/ErtanOzdemir/careerden/releases/latest">
    <img src="https://img.shields.io/github/v/release/ErtanOzdemir/careerden?display_name=tag&sort=semver&label=release" alt="Latest release" />
  </a>
  <a href="https://github.com/ErtanOzdemir/careerden/releases">
    <img src="https://img.shields.io/github/downloads/ErtanOzdemir/careerden/total?label=downloads" alt="Total downloads" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" />
  </a>
  <a href="https://github.com/ErtanOzdemir/careerden/actions/workflows/ci.yml">
    <img src="https://github.com/ErtanOzdemir/careerden/actions/workflows/ci.yml/badge.svg?event=pull_request" alt="CI status" />
  </a>

<br /><br />

<a href="https://careerden.app/download"><strong>Download</strong></a>
·
<a href="https://careerden.app"><strong>Website</strong></a>
·
<a href="https://github.com/ErtanOzdemir/careerden/releases"><strong>Releases</strong></a>

</div>

![Fictional Careerden application tracking dashboard with active applications, a follow-up calendar, and the application pipeline](./docs/images/application-tracking-dashboard.png)

The dashboard opens on active applications, the follow-up calendar, and the pipeline across
every stage, with the counts and match scores updating in real time over server-sent events.

## Editions

Careerden ships as two desktop apps built from the same code and released together.

|                      | **Careerden**                                                     | **Careerden Unplugged**                                                    |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Where data lives     | Careerden's servers (PostgreSQL and object storage)               | Only on your device                                                        |
| Account              | Email and password with email OTP                                 | None                                                                       |
| AI                   | Included, metered by monthly credits and subscriptions            | Your own OpenAI, Anthropic, Gemini, DeepSeek, or OpenRouter key; unmetered |
| Billing              | Free monthly credits and a Creem subscription                     | None                                                                       |
| Reminders            | In-app, desktop, and optional email                               | In-app and desktop                                                         |
| Works across devices | Yes, through your account                                         | No; one device, one profile                                                |
| Network traffic      | The Careerden API, LinkedIn guest pages, and GitHub update checks | LinkedIn guest pages, your AI provider, and GitHub update checks only      |

"Unplugged" means unplugged from Careerden's servers, not from the internet. Both editions
share the same features otherwise: the tracker, the profile, LinkedIn import, AI match
analysis, document editing and PDF generation, and follow-up reminders. They install side
by side under separate identities (`com.careerden.desktop` and `com.careerden.unplugged`)
with separate data, keychain entries, and update channels.

## Features

Every screenshot below is the desktop workspace filled with fictional sample data.

### Track every application in one place

![Careerden applications list sorted by interest, with status filters and search](./docs/images/applications-list-sorting.png)

- Add applications by pasting company and job details manually, with an optional company logo,
  website, location, and source URL, or import a LinkedIn job through the desktop app.
- Filter by status, search by company or role, and sort by match, interest, salary, or date
  added; select a column again to reverse it, once more to return to recently updated first.
- Keep inactive roles out of the way with a reversible archive.

### Keep the decision context with the role

![Careerden application Overview with role summary, job details, and company details](./docs/images/application-overview.png)

- Manage application stages, interest level, tags, salary range and type, work style,
  contacts, timeline events, and multiple follow-ups per application.
- Review the captured role summary, the source, and company details next to the match score.
- Follow-up reminders arrive in the app and as native operating-system alerts, with optional
  email delivery through local SMTP or production Resend in the cloud edition.

### Maintain one career profile

![Careerden career profile with basic information, summary, skills, and experience](./docs/images/career-profile.png)

- Maintain a reusable profile with experience, education, projects, certifications,
  links, and analysis/reminder preferences.
- Everything tailored for an application is grounded in these details.

### Choose the CV layout every document starts from

![Careerden base resume page with an A4 preview and six CV templates](./docs/images/base-resume-templates.png)

- Preview your profile as an A4 page in Classic, Editorial, Modern, Minimal, Technical, or
  Ledger, then set one as the default.
- Every tailored CV starts from that layout, and you can still switch it for a single
  application.

### Review the match analysis and the tailored pack

![Careerden application pack with match analysis, a live CV preview, and improvement tips](./docs/images/application-pack.png)

- Analyze each role against the profile with OpenAI, Gemini, DeepSeek, Anthropic, or
  OpenRouter and review matched, partial, and missing requirements.
- Edit AI-assisted CV and cover-letter content before generating files, with a live
  on-screen HTML preview rendered from a predefined template as you edit.
- Generate CV and cover-letter PDFs from the same predefined HTML templates, then
  download them through signed, expiring URLs.

### Accept only the improvements you can back up

![Careerden improvement tip opened as a suggested change with accept and discard controls](./docs/images/improvement-tips.png)

- Each tip opens as a suggested change you can accept or discard; accepted edits appear in
  the CV preview immediately, and you can undo them or save them to the profile.
- Keyword coverage shows which job terms the CV already uses, and gap questions are answered
  in your own words so the AI adds no fact you did not provide.

### Accounts and AI keys

- Cloud edition: sign in with email and password using email OTP verification.
- Unplugged edition: no account; bring your own AI provider key, stored with the operating
  system's keychain and never sent anywhere but the provider.

## Quick Start

```bash
git clone git@github.com:ErtanOzdemir/careerden.git
cd careerden

nvm use                                 # Node.js 22, pinned in .nvmrc
corepack enable                         # pnpm 9.15.0
pnpm install
pnpm exec playwright install chromium   # PDF rendering

cp .env.example .env                    # then set OPEN_OBSERVE_KEY and an AI provider key
docker compose up -d                    # PostgreSQL, Redis, RustFS, MailHog, OpenObserve
pnpm dev:desktop                        # API, web, workers, and Electron
```

Careerden Unplugged needs no Docker services, no `.env`, and no account:

```bash
pnpm dev:desktop:local
```

Full prerequisites, per-service commands, local service addresses, and the quality gates
are in the [development guide](docs/development.md).

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
responses and HTML parsing; it does not require a LinkedIn account. The API persists
workflow changes and outbox events transactionally, and the LLM, documents, and
notifications workers consume BullMQ jobs independently from it. Careerden Unplugged runs
the same routes and use cases inside the app instead, against an embedded PostgreSQL
database, with analysis on the user's own AI key.

Each cloud account receives 10 free AI credits per UTC calendar month; a match analysis
reserves one credit in the same transaction that records the attempt, and the worker
consumes it only after validated output is persisted. A Creem subscription adds 100
credits per paid period. Unplugged has no credits.

Jobs move through explicit states:

```text
queued -> scraping -> scraped -> analyzing -> review_ready -> generating_documents -> completed
```

The [architecture guide](docs/architecture.md) covers the full pipeline, the Unplugged
runtime, credit settlement, the monorepo layout, and the decisions behind them.

## Architecture

Careerden is a strict ESM TypeScript monorepo organized around clean architecture and
bounded contexts. `apps/` holds the Express API, the Electron desktop shell, three BullMQ
workers, and the React web app; `packages/` holds the domain, application, contracts,
config, and infrastructure layers. Dependencies point inward: apps compose packages,
application code depends on domain and contracts, and infrastructure implements domain
interfaces.

Both editions are built from the same code and differ only in the adapters their
composition roots choose — PostgreSQL or PGlite, S3-compatible storage or local disk,
BullMQ workers or an in-process outbox runner, Better Auth or a loopback token. See
[docs/architecture.md](docs/architecture.md) for the full picture and the tech stack.

## Documentation

| Guide                                  | Contents                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| [Development](docs/development.md)     | Prerequisites, setup, both editions locally, commands, test gates |
| [Architecture](docs/architecture.md)   | Pipeline, Unplugged runtime, monorepo layout, decisions, stack    |
| [Configuration](docs/configuration.md) | Every environment variable and its default                        |
| [API Reference](docs/api.md)           | All HTTP routes, filters, and response conventions                |
| [Deployment](docs/deployment.md)       | Cloudflare R2 and the API/worker containers on Coolify            |
| [Desktop](apps/desktop/README.md)      | Electron runtime, packaging, signing, and the release checklist   |
| [Contributing](CONTRIBUTING.md)        | Workflow, branch and commit conventions, PR checklist             |
| [Security](SECURITY.md)                | Supported versions and how to report a vulnerability              |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code conventions,
and pull request checklist. Security issues should follow [SECURITY.md](SECURITY.md).

## License

Careerden is free and open-source software licensed under the
[GNU Affero General Public License v3.0](LICENSE).

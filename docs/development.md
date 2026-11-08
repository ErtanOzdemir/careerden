# Development

How to run Careerden locally, work on either edition, and pass the quality gates. See
[CONTRIBUTING.md](../CONTRIBUTING.md) for the branch, commit, and pull request workflow,
[configuration.md](configuration.md) for every environment variable, and
[architecture.md](architecture.md) for how the pieces fit together.

## Prerequisites

- Node.js 22 (the version is pinned in `.nvmrc`)
- pnpm 9.15.0
- Docker with Docker Compose
- A Chromium browser installed for Playwright PDF rendering

## Setup

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
3. Replace the development auth secret before using the app outside local development.

Start the complete cloud desktop development stack:

```bash
pnpm dev:desktop
```

The command starts the API, React/Vite web app, LLM worker, documents worker,
notifications worker, and Electron desktop app through Turbo. Electron waits until the API health
check and the Vite dev server respond before opening its window. On first use, create an account and open MailHog at
<http://localhost:8025> to read the verification OTP. The desktop app can then process submitted
LinkedIn URLs through public guest endpoints without connecting a LinkedIn account.

The example environment also enables follow-up reminder email delivery, so those messages appear in
the same MailHog inbox. Keep `NOTIFICATION_EMAIL_ENABLED=false` in environments where reminder
emails should not be dispatched.

## Careerden Unplugged in Development

The Unplugged edition needs no Docker services, no `.env` changes, and no account:

```bash
pnpm dev:desktop:local
```

The command starts the Vite web app and Electron with the local edition enabled. Electron
starts the embedded backend on loopback port `3010` with a per-run token that the Vite proxy
forwards. Data lives in the `Careerden Unplugged` folder under the operating system's
application data directory. To skip typing a profile, fill it with a fictional sample while
the app is closed:

```bash
pnpm seed:local-profile
```

Add an AI provider key on the **AI provider** page to run match analysis. OpenRouter accepts
any model id, but choose one that supports structured outputs; some free models only work in
approved apps.

## Local Services

| Service        | Address                        | Purpose                              |
| -------------- | ------------------------------ | ------------------------------------ |
| Web app        | <http://localhost:5173>        | Vite development server              |
| API            | <http://localhost:3000>        | Express API                          |
| API health     | <http://localhost:3000/health> | Runtime health check                 |
| PostgreSQL     | `localhost:5432`               | Application and authentication state |
| Redis          | `localhost:6380`               | BullMQ and real-time change delivery |
| MailHog        | <http://localhost:8025>        | Development email inbox              |
| RustFS API     | <http://localhost:9000>        | S3-compatible object storage         |
| RustFS console | <http://localhost:9001>        | Object-storage administration        |
| OpenObserve    | <http://localhost:5080>        | OpenTelemetry trace collection       |

The Vite proxy also exposes the health check at <http://localhost:5173/api/health>.

## Common Commands

| Command                                                        | Purpose                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                                     | Start Docker services, then every app through Turbo      |
| `pnpm dev:desktop`                                             | Start API, web, workers, then Electron once they respond |
| `pnpm dev:desktop:local`                                       | Start the web app and Careerden Unplugged without Docker |
| `pnpm seed:local-profile`                                      | Fill the Unplugged profile with a fictional sample       |
| `pnpm dev:services`                                            | Start PostgreSQL, Redis, and RustFS and wait for them    |
| `pnpm dev:api`                                                 | Start only the API                                       |
| `pnpm dev:llm-worker`                                          | Start only the LLM worker                                |
| `pnpm dev:documents-worker`                                    | Start only the documents worker                          |
| `pnpm dev:notifications-worker`                                | Start only the notifications worker                      |
| `pnpm --filter @careerden/web dev`                             | Start only the Vite web app                              |
| `pnpm --filter @careerden/desktop build`                       | Build the Electron main process and renderer             |
| `pnpm --filter @careerden/desktop package`                     | Package desktop for the current host platform            |
| `pnpm --filter @careerden/desktop package:local`               | Package Careerden Unplugged after a local edition build  |
| `pnpm --filter @careerden/infrastructure smoke:playwright-pdf` | Verify local Playwright PDF rendering                    |
| `pnpm verify:desktop-release <tag>`                            | Check a desktop release has every edition's metadata     |
| `pnpm build`                                                   | Build every workspace                                    |
| `pnpm test`                                                    | Run all Vitest suites                                    |
| `pnpm lint`                                                    | Run ESLint                                               |
| `pnpm format:check`                                            | Check Prettier formatting                                |
| `pnpm typecheck`                                               | Type-check every workspace                               |
| `pnpm lint:fix` / `pnpm format`                                | Apply mechanical lint/format fixes                       |

Backend development commands run `tsx watch` with Node's `development` export condition. Internal
`@careerden/*` packages therefore resolve directly to their TypeScript sources and trigger an app
restart when a dependency changes. `NODE_ENV` still controls runtime behavior independently; even
a local production-mode check keeps source hot reload while it is launched through a `dev` command.

Use `docker compose up -d` instead of `pnpm dev:services` when local OTP email and
OpenObserve are also needed.

Desktop installers for both editions are produced by the tag-triggered GitHub Actions
workflow as one draft release together with platform updater metadata and the
minimum-supported-version policy. Build Careerden Unplugged locally with
`CAREERDEN_EDITION=local VITE_CAREERDEN_EDITION=local pnpm --filter @careerden/desktop build`. Publishing remains a manual verification step and is what makes a release
visible to installed updaters. Follow the complete
[desktop release checklist](../apps/desktop/README.md#draft-release-workflow) before tagging
or publishing a version.

## Database Migrations

PostgreSQL migrations run automatically during API startup, and in Careerden Unplugged on
every app start against its embedded PGlite database. Because local migrations run on users'
devices where they cannot be rolled back, keep migrations additive. Before a version change or
pending migrations, Unplugged copies its data to `userData/backups/` first (see
[pre-migration snapshots](../apps/desktop/README.md#pre-migration-snapshots)), but that is a
recovery path, not a rollback. They can also be managed
from the repository root:

```bash
pnpm migrate:status
pnpm migrate:latest
pnpm migrate:rollback
pnpm migrate:make <migration-name>
```

Additional one-step controls are available as `pnpm migrate:up` and
`pnpm migrate:down`.

### Database Upgrade Fixtures

An empty test database cannot catch a migration that only fails on real data, such as a new
`NOT NULL` column, a unique index, or a data transform. `apps/api/test/fixtures/pglite/`
therefore keeps one Careerden Unplugged database per released version, filled with a
realistic sample: a profile, applications in every stable processing state plus an archived
one, generated documents, follow-ups, notifications, and outbox events. As part of
`pnpm test`, `apps/api/src/local/local-database-upgrade.test.ts` restores each fixture into a
temporary data directory, starts the local runtime on it so the current migrations run as they
do on a user's device, and reads the data back through the HTTP routes.

Each fixture directory holds:

- `database.sql`: a plain `pg_dump` of the embedded database. A PGlite data directory is about
  38 MB even when empty (4.5 MB compressed) and binary, while the dump is about 60 KB of
  reviewable text.
- `files/`: the stored document files the database points at, in the local file storage layout.
- `fixture.json`: the source tag and commit, the migrations it was built with, and what the
  upgrade test expects to read back.

Generate the fixture for a new release once its tag exists, then commit it in a follow-up pull
request. The release workflow warns when the tag has no fixture:

```bash
pnpm --filter @careerden/api-app fixture:pglite --ref v0.8.0
```

`--ref` defaults to the tag for the version in `apps/desktop/package.json`. The script runs only
the migrations committed at that ref, so the database has that release's schema even when the
script runs from a later checkout. The sample rows live in
`apps/api/scripts/pglite-fixture-seed.mjs`; columns that did not exist at the release are left
out. Extend the sample when a release adds tables or data shapes worth covering. Released
fixtures are frozen: the script refuses to overwrite one unless `--force` is passed, and an
existing fixture should never be rebuilt to make a failing migration pass.

## Testing and Quality Gates

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

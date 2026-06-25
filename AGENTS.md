# Link2CV Agent Guide

## Project Overview

Link2CV is a TypeScript monorepo for turning LinkedIn job postings into profile-aware
CV and cover-letter documents. The app scrapes job and company data, stores raw and
normalized scrape results, optionally runs AI matching/document generation, and renders
documents for review or download.

## Tech Stack

- Runtime: Node.js 22 (`.nvmrc`)
- Package manager: pnpm 9.15.0
- Language: TypeScript 5.7, strict mode, ESM, `moduleResolution: "NodeNext"`
- Monorepo orchestration: Turborepo 2.3
- Linting and formatting: ESLint 10, typescript-eslint 8.61, Prettier 3.8
- Testing: Vitest 2.1
- API: Express 4.21, Zod 3.24 for validation
- Desktop runtime: Electron 33 with an embedded Express server
- Web app: React 19, React Router 7, Vite 6, Tailwind CSS 4, Tiptap 3
- Persistence: SQLite via `better-sqlite3` 11.7 and Knex 3.1 for database
  access and migrations
- Scraping and rendering: Playwright 1.49
- AI: Vercel AI SDK 6 with OpenAI, Gemini, and DeepSeek provider packages 2.x
- Document generation: HTML templates, Docxtemplater, LibreOffice/Playwright PDF rendering
- Storage: local desktop file storage

## Naming Conventions

- Workspace packages use the `@link2cv/*` scope.
- Backend and package source files use kebab-case names, for example
  `process-job-application.ts` and `self-processing-job-application.queue.ts`.
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
- The current desktop-first runtime starts an Electron app, creates an embedded Express
  server on an available local port, and passes that port to the web app as `?apiPort=...`.
- The desktop runtime uses SQLite for local state, local file storage for generated files,
  and an in-process self-processing queue for job application processing.
- SQLite migrations are run through Knex during desktop server startup.

## Runtime Validation Commands

- Start all development targets:
  ```bash
  pnpm dev
  ```
- Start the desktop app with the web dev server:
  ```bash
  pnpm dev:desktop
  ```
- Check whether the Vite web dev server is listening:
  ```bash
  curl -I http://localhost:5173
  ```
- Check the proxied API health endpoint when using the Vite proxy:
  ```bash
  curl http://localhost:5173/api/health
  ```
- Check the embedded desktop API health endpoint when the `apiPort` value is known from
  the desktop launch URL:
  ```bash
  curl http://localhost:<apiPort>/health
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

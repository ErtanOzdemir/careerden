# Architecture

## Runtime and Layer Ownership

- `apps/api`: Express transport, authentication middleware, validation invocation, response mapping, SSE lifecycle, and composition root.
- `packages/application`: focused commands/queries, ownership checks, workflow orchestration, read-model assembly, and typed expected failures.
- `packages/domain`: entities, workflow policies, repository/provider/queue interfaces, and stable constants.
- `packages/contracts`: shared Zod schemas and transport DTO types; it must not depend on application or infrastructure.
- `packages/infrastructure`: PostgreSQL/Knex repositories, Redis/BullMQ adapters, site scrapers, AI adapters, storage, DOCX/HTML/PDF renderers, and migrations.
- `apps/desktop`: Electron runtime and local guest-HTTP scraping worker; it claims API work, heartbeats claims, and submits scrape results.
- `apps/llm-worker`: BullMQ consumer for match analysis.
- `apps/notifications-worker`: BullMQ consumer and recovery loop for follow-up reminders.
- `apps/web`: React client using shared REST behavior through its API client/mappers.

Dependencies point inward: apps compose packages; application depends on domain/contracts; infrastructure implements domain interfaces. Do not make domain depend on application, apps, or infrastructure. Avoid infrastructure depending on application.

## Bounded Contexts

Use the same context name across layers:

- `profiles`: user-linked profiles, ownership access, document templates, mappings, and aliases.
- `job-applications`: tracking lifecycle, scrape claims, events, contacts, follow-ups, analysis, read models, and documents.
- `scraping`: scrape contracts and site-specific adapters.
- `matching`: AI provider contracts, requirement extraction, and match analysis.
- `documents`: content, templates, deterministic rendering, and generated files.
- `notifications`: reminders, notification persistence, delivery, and recovery.
- `storage`, `queue`, and `persistence`: infrastructure adapters grouped by their owning capability/context.

Do not reintroduce cross-context generic source buckets. Keep package barrels stable while internal files remain context-oriented.

## Application and API Shape

- Use one exported class per operation, named `VerbNounUseCase` in `verb-noun.use-case.ts`.
- Put reusable access checks and projection builders in internal context helpers, not routes.
- Use narrow repository capabilities such as `UserProfileAccessRepository` when a use case only needs ownership/read access.
- Protected use cases receive `userId`/actor input and independently enforce access; API parameter middleware may provide defense in depth but is not the business authorization boundary.
- API routers receive use cases and transport services only. The API composition root creates concrete repositories/adapters and wires them into use cases.
- Keep SSE headers, heartbeat timers, disconnect cleanup, multipart parsing, and basic file/MIME checks in the API layer.

## Adapter and Worker Rules

- Resolve site scrapers through Strategy/Factory patterns. LinkedIn is one adapter, not a core-workflow special case.
- Keep AI, file storage, template rendering, PDF conversion, email, persistence, and queues behind domain interfaces.
- API runtimes produce queue work; `apps/*-worker` runtimes consume it.
- Convert typed terminal application failures to BullMQ `UnrecoverableError`; rethrow unexpected failures unchanged so queue attempts/backoff apply.
- Keep worker logging and runtime recovery mechanics in worker apps, while status/event business behavior stays in use cases.

## Current Infrastructure

- Node.js 22, pnpm 9, strict ESM TypeScript with `NodeNext`.
- PostgreSQL via Knex, migrations during API startup.
- Redis/BullMQ for LLM processing and reminder delivery/recovery.
- S3-compatible object storage via RustFS locally and Cloudflare R2 in production for
  generated/template/logo files.
- Public guest HTTP responses and HTML parsing for desktop scraping; Playwright for PDF rendering.
- Vercel AI SDK providers behind AI interfaces.

## Non-Negotiables

- Preserve normalized and raw scrape data.
- Preserve explicit workflow transitions and failure reasons/events.
- Keep the core independent from a single job site, AI provider, storage service, renderer, or transport.
- Keep REST URLs and payload compatibility during boundary-only refactors.

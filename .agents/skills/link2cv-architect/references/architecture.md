# Architecture

## Stack

- Use `Express` for HTTP APIs.
- Use `PostgreSQL` for durable app state.
- Use `Redis + BullMQ` for background jobs and retries.
- Use `Playwright` workers for browser-based scraping.
- Use HTML templates first for documents, then render to PDF.

## Modules

- `api`: request validation, controllers, response mapping.
- `application`: use cases such as job submission, scraping orchestration, AI matching, and document generation.
- `domain`: entities, value objects, workflow state, and provider interfaces.
- `infrastructure`: DB repositories, scrapers, AI clients, template rendering, PDF conversion, file storage.
- `workers`: separately runnable `apps/*-worker` packages for BullMQ processors and retry/recovery orchestration.

## Bounded Context Layout

Keep source organized by business context inside each package instead of by generic technical folders.

- `profiles`: profile entities, repository contracts, schemas, use cases, and API routes.
- `job-applications`: application lifecycle, workflow status, queue contracts, persistence, submission, processing, API routes, and worker entrypoints.
- `scraping`: job/company scrape models, scraper contracts, LinkedIn session handling, site adapters, and scraper factories.
- `matching`: AI provider contracts, AI schemas, requirement extraction, match analysis, and AI provider adapters.
- `documents`: generated document models, rendering contracts, document generation, HTML templates, and PDF rendering.
- `storage`: file-storage contracts and storage adapters.
- `persistence`: infrastructure database setup, repositories, migrations, and schema files.
- `queue`: infrastructure queue adapters.

Use the same context name across layers when a feature crosses packages. For example, a new job-application capability should place domain types under `packages/domain/src/job-applications`, use cases under `packages/application/src/job-applications`, schemas under `packages/contracts/src/job-applications`, and API routes under `apps/api/src/job-applications`.

Worker apps should be named for their responsibility and include the `worker` suffix. For example, `apps/llm-worker` owns LLM analysis jobs, while a future notification processor should use a name such as `apps/notifications-worker`.

Do not reintroduce broad folders like `entities`, `interfaces`, `schemas`, `routes`, or `use-cases` for backend source. Package barrels should keep public `@link2cv/*` imports stable while internals stay context-oriented.

## Patterns

- Use Strategy for site-specific scrapers.
- Use Factory to resolve the right scraper from a URL.
- Use Adapter for AI providers, storage, and PDF rendering.
- Use Repository for database access.
- Use a queue-driven pipeline for all long-running processing.
- Keep API runtimes as producers/controllers only; BullMQ consumers belong in worker apps.

## Tooling

- Run `pnpm lint` for ESLint checks and `pnpm lint:fix` only for mechanical fixes.
- Run `pnpm format:check` before finishing; use `pnpm format` for repo-wide Prettier formatting.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` after source or structure changes.
- Keep generated output, caches, local storage, and dependency folders out of source edits.

## Non-Negotiables

- Keep LinkedIn support as one adapter, not a special case spread across the app.
- Keep future career sites additive.
- Keep raw scraped data and normalized data both available.
- Keep the core workflow independent from any single AI vendor.
- Keep bounded-context placement and tooling checks current in contributor and agent docs when architecture changes.

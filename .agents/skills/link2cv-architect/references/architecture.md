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
- `workers`: BullMQ processors and retry/recovery orchestration.

## Patterns

- Use Strategy for site-specific scrapers.
- Use Factory to resolve the right scraper from a URL.
- Use Adapter for AI providers, storage, and PDF rendering.
- Use Repository for database access.
- Use a queue-driven pipeline for all long-running processing.

## Non-Negotiables

- Keep LinkedIn support as one adapter, not a special case spread across the app.
- Keep future career sites additive.
- Keep raw scraped data and normalized data both available.
- Keep the core workflow independent from any single AI vendor.

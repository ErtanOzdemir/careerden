# Contracts

## Contract Placement

- Put external/shared DTO validation in `packages/contracts/src/<context>` using Zod.
- Put stable business entities, repository/provider interfaces, queue payloads, and policies in `packages/domain/src/<context>`.
- Put application-only command/query inputs, results, read models, and expected errors beside their use cases.
- Validate before persistence, queueing, AI result use, or rendering.

## Core Interfaces

- `JobSiteScraper`: select by URL, scrape jobs, and scrape companies without leaking site conditionals into workflows.
- `AiProvider`: generate schema-validated output from provider-neutral prompts/parameters.
- `JobApplicationRepository` and `UserProfileRepository`: persistence boundaries; introduce narrower capability interfaces when consumers need only a subset.
- `JobApplicationQueue` and `FollowUpReminderQueue`: producer interfaces; BullMQ remains an adapter detail.
- `TemplateRenderer`, `DocxTemplateRenderer`, `DocumentRenderer`, and `FileStorage`: deterministic rendering and storage boundaries.

## REST and Read Models

- Preserve existing REST endpoints during architectural refactors.
- Build enriched list/detail projections in application code, including documents, events, contacts, follow-ups, sanitized scrape data, match results, and signed logo URLs.
- Keep HTTP parsing, headers, status selection, multipart mechanics, and final serialization in API code.
- Do not expose internal logo source/file fields inside public scrape payloads.

## Authentication and Ownership

- Authentication middleware supplies a stable actor with `id`, `email`, and `name`.
- Protected use cases accept the actor/user ID and verify profile/job/resource ownership through domain repository interfaces.
- Return typed not-found failures for inaccessible owned resources when ownership disclosure is undesirable.

## Testing Expectations

- Colocate use-case tests as `*.use-case.test.ts` and cover success, ownership isolation, expected failures, and orchestration side effects.
- Test Zod contracts independently.
- Test persistence/queue adapters with integration-focused tests.
- Test renderers and provider adapters independently from use cases.
- Keep API tests focused on validation, authentication, error/status mapping, and transport lifecycle behavior.

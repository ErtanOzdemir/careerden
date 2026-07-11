---
name: link2cv-architect
description: Design, implement, and review Link2CV's Node.js/TypeScript architecture across API, application, domain, contracts, infrastructure, Electron desktop scraping, BullMQ workers, persistence, AI matching, document generation, storage, and tests. Use for backend features, refactors, boundaries, workflows, adapters, queues, error handling, or package organization in the Link2CV repository.
---

# Link2CV Architect

Keep Link2CV modular, transport-independent, and expandable across job sites and providers.

## Core Workflow

1. Inspect the affected bounded context across API, application, domain, contracts, infrastructure, desktop, and workers.
2. Put business decisions and orchestration in a focused application use case; put invariants and stable policies in domain code.
3. Keep adapters and runtime mechanics in infrastructure or the owning app.
4. Preserve public package exports and external REST behavior unless the task explicitly changes them.
5. Add tests at the layer that owns the changed behavior.

## Required Conventions

- Keep Express handlers transport-only: validate/parse input, extract the authenticated actor, call use cases, and map responses. Never inject repositories, queues, storage, renderers, or infrastructure managers into route modules.
- Construct repositories, adapters, queues, and use cases in app composition roots.
- Give every exported `*UseCase` class its own matching kebab-case `*.use-case.ts` file. Name its colocated test `*.use-case.test.ts`. Keep shared helpers free of a `UseCase` suffix.
- Organize every backend package by bounded context. Do not create broad `entities`, `interfaces`, `schemas`, `routes`, or `use-cases` buckets.
- Pass `userId` or an authenticated actor into protected use cases and enforce ownership in application code. Return not-found semantics for inaccessible owned resources when disclosure must be avoided.
- Keep site, AI, storage, rendering, persistence, and queue variations behind domain interfaces and infrastructure adapters.
- Keep long-running consumers in descriptive `apps/*-worker` runtimes. Workers call use cases; they do not own business rules.
- Preserve raw scrape payloads with normalized data for traceability.
- Use internal relative TypeScript imports with the runtime `.js` extension and stable `@link2cv/*` package barrels for public imports.
- Use Conventional Commit subjects such as `feat:`, `fix:`, `refactor:`, `test:`, or `docs:` when committing.

## Reference Routing

- Read [architecture.md](references/architecture.md) before changing packages, dependencies, module boundaries, naming, or composition roots.
- Read [workflow.md](references/workflow.md) before changing scraping, job status transitions, retries, queues, analysis, reminders, or documents.
- Read [contracts.md](references/contracts.md) before changing DTOs, Zod schemas, domain/provider interfaces, read models, or REST payloads.
- Read [errors.md](references/errors.md) before changing API errors, desktop API behavior, worker retries, or terminal failure handling.

## Decision Rules

- Prefer additive site/provider adapters over conditionals spread through workflows.
- Prefer explicit use-case inputs/results and status transitions over implicit repository orchestration.
- Prefer deterministic schemas and render inputs over prompt-only behavior.
- Keep transport codes and BullMQ retry semantics out of domain rules.
- Treat unexpected infrastructure/provider failures as retryable unless a typed application failure explicitly makes them terminal.

## Verification

- Run focused tests and checks while iterating.
- For structural or behavioral changes, run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- If a repository-wide gate fails only on unrelated pre-existing files, leave them untouched, run focused checks for changed files, and report the exception precisely.

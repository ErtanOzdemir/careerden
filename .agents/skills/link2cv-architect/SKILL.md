---
name: link2cv-architect
description: Design and implement the Link2CV Node.js/TypeScript backend architecture. Use when working on this repo's app structure, LinkedIn-first scraping, future career-site adapters, BullMQ workers, AI matching, template rendering, PDF generation, API boundaries, data model, or tests.
---

# Link2CV Architect

Use this skill to keep Link2CV modular and expandable while building the backend.

## Operating Rules

- Prefer a backend-first architecture with clear boundaries between API, application, domain, and infrastructure code.
- Keep scraping behind site-specific adapters; add a new adapter instead of branching the core workflow.
- Keep AI providers, document rendering, and storage behind interfaces so they can be swapped without changing use cases.
- Push long-running work into queue workers; keep HTTP handlers thin and synchronous.
- Validate external inputs and AI output with schemas before persisting or rendering anything.
- Preserve raw scrape payloads alongside normalized data for traceability.

## When To Load References

- Read [architecture.md](references/architecture.md) before proposing modules, packages, or service boundaries.
- Read [workflow.md](references/workflow.md) before changing the job-processing pipeline or queue design.
- Read [contracts.md](references/contracts.md) before defining entities, DTOs, provider interfaces, or AI JSON output.

## Decision Rules

- Choose extensibility over hard-coded LinkedIn assumptions.
- Choose deterministic outputs over prompt-only behavior for AI and document generation.
- Choose explicit state transitions over implicit status updates.
- Choose adapters and factories for anything that will vary by provider, source site, or file format.

## Implementation Checks

- Keep API routes thin and delegate to use cases.
- Keep business rules in application/domain code, not in controllers or workers.
- Keep infrastructure code isolated to database, scraping, AI, PDF, and storage integrations.
- Add tests at the level of the behavior being changed: unit for logic, integration for queues and persistence, contract for provider boundaries.

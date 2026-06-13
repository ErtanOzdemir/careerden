# Link2CV

Link2CV is a TypeScript monorepo for turning LinkedIn job postings into profile-aware CV and cover-letter PDFs.

## Workspace

- `apps/api` - Express HTTP API.
- `apps/worker` - BullMQ background worker for scraping, AI matching, and document generation.
- `apps/web` - Frontend app placeholder.
- `packages/domain` - Entities, workflow state, and provider interfaces.
- `packages/application` - Use cases and orchestration.
- `packages/infrastructure` - Database, scraping, AI, rendering, PDF, queue, and storage adapters.
- `packages/contracts` - Shared DTOs and validation schemas.
- `packages/config` - Environment loading.

## Local Services

```sh
docker compose up -d
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm dev
```

# Contributing to Careerden

Thanks for your interest in contributing! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Desktop Releases](#desktop-releases)
- [Adding New Features](#adding-new-features)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9.15+
- Docker with BuildKit when validating production images
- Git

### Setup

1. **Fork** the repository on GitHub.

2. **Clone** your fork:

   ```bash
   git clone git@github.com:<your-username>/careerden.git
   cd careerden
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   # Required for Playwright PDF rendering and its smoke test.
   pnpm exec playwright install chromium
   ```

4. **Set up environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your API keys if needed
   ```

5. **Start development**:
   ```bash
   pnpm dev
   ```

## Development Workflow

1. Create a new branch from `master` (see [Branch Naming](#branch-naming)).
2. Make your changes in small, focused commits.
3. Write or update tests for your changes.
4. Run the relevant verification commands before opening a PR.
5. Push your branch and open a pull request.

For source changes, the full local verification set is:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs the same gates for every pull request targeting `master`.

Use `pnpm lint:fix` and `pnpm format` for mechanical cleanup. Do not hand-format code to work around Prettier; let the formatter own whitespace and wrapping.

Changes to runtime dependencies, rendering, package builds, or deployment configuration
must also validate the affected production image from the repository root. The available
image commands and Coolify settings are documented under
[Production containers on Coolify](README.md#production-containers-on-coolify).

## Branch Naming

Use descriptive branch names with a type prefix:

| Prefix      | Purpose            | Example                          |
| ----------- | ------------------ | -------------------------------- |
| `feat/`     | New feature        | `feat/add-cover-letter-template` |
| `fix/`      | Bug fix            | `fix/scraping-timeout-handling`  |
| `docs/`     | Documentation      | `docs/update-api-reference`      |
| `refactor/` | Code restructuring | `refactor/extract-pdf-renderer`  |
| `test/`     | Adding tests       | `test/add-match-analysis-tests`  |
| `chore/`    | Maintenance        | `chore/update-dependencies`      |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no feature or fix)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(api): add job application filtering by status
fix(worker): handle LinkedIn rate limiting gracefully
docs: update environment variables reference
test(contracts): add schema validation tests for profiles
```

## Pull Request Process

1. **Fill out the PR template** completely.
2. **Link related issues** (e.g., "Closes #42").
3. **Ensure CI passes** — all checks must be green.
4. **Request review** from a maintainer.
5. **Address feedback** — push additional commits as needed.
6. **Squash and merge** once approved.

### PR Checklist

- [ ] Branch is up to date with `master`
- [ ] Lint passes (`pnpm lint`)
- [ ] Formatting passes (`pnpm format:check`)
- [ ] Code compiles without errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
- [ ] Build passes when source files changed (`pnpm build`)
- [ ] New code has corresponding tests
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] PR description explains the change

## Coding Standards

### TypeScript

- **Strict mode** is enabled — no `any` types without justification.
- Use **ESM** (`import`/`export`), not CommonJS.
- Prefer `type` over `interface` for simple shapes.
- Use `readonly` for immutable data.

### Validation

- All external data must be validated with **Zod schemas** (in `packages/contracts`).
- API request/response types must derive from Zod schemas.

### Error Handling

- Use typed errors, not string messages.
- Let infrastructure errors propagate to error-handling middleware.
- Expose typed application error messages only. Unexpected failures must use the generic
  public message and a trace ID.
- Keep unexpected-error logs structured and redacted. Do not log request headers, bodies,
  query parameters, credentials, session data, tokens, or complete profile/scrape payloads.

### Browser Security Headers

- Keep API, Vite web, Next.js marketing, and packaged Electron CSPs tailored to their
  actual resource and runtime requirements. Do not widen one policy to solve another
  surface's integration.
- Add external origins only from trusted build/runtime configuration and cover policy
  changes with regression tests.
- Keep production HSTS out of local development responses. Deployments serving the Vite
  build must apply its generated `dist/_headers` file or an equivalent edge configuration.

### File Structure

- Keep files small and focused.
- One exported entity per file when possible.
- Follow existing naming conventions in each package.
- Organize backend code by context inside each package, such as `profiles`, `job-applications`, `scraping`, `matching`, and `documents`.
- Do not add broad backend buckets such as `entities`, `interfaces`, `schemas`, `routes`, or `use-cases`; place files in the relevant context folder instead.

Context placement by layer:

| Layer                   | Place context code in                              |
| ----------------------- | -------------------------------------------------- |
| Domain models/contracts | `packages/domain/src/<context>`                    |
| Use cases               | `packages/application/src/<context>`               |
| Zod/API contracts       | `packages/contracts/src/<context>`                 |
| Infrastructure adapters | `packages/infrastructure/src/<adapter-or-context>` |
| API routes              | `packages/api/src/<context>`                       |
| Frontend UI             | `apps/web/src`                                     |

Current backend contexts are `profiles`, `job-applications`, `scraping`, `matching`,
`documents`, `notifications`, `storage`, `persistence`, and `queue`.

### Linting and Formatting

- ESLint uses the root `eslint.config.mjs` flat config.
- Prettier uses `.prettierrc.json` and `.prettierignore`.
- Run `pnpm lint` and `pnpm format:check` before opening a PR.
- Run `pnpm lint:fix` or `pnpm format` when the tools can safely make mechanical changes.

### Imports

- Use `@careerden/*` package aliases for cross-package imports.
- Group imports: external → internal → relative.

## Testing

- Write tests for all new features and bug fixes.
- Place tests next to the source file as `*.test.ts`.
- Use descriptive test names that explain the behavior.
- Prefer `describe` blocks for grouping related tests.

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @careerden/domain test

# Run tests in watch mode
pnpm vitest --filter @careerden/contracts
```

## Desktop Releases

Desktop releases are built from a `v*.*.*` tag by
`.github/workflows/desktop-release.yml`. The tag must match the version in
`apps/desktop/package.json`. The workflow builds the macOS universal DMG and ZIP,
Windows x64 NSIS installer, and Linux x64 AppImage. It also attaches electron-updater
metadata, blockmaps, the validated minimum-version policy, and `SHA256SUMS.txt` to a
draft GitHub release.

Before creating a tag:

- Run the full repository verification set and ensure the release commit is on the
  protected/default branch.
- Confirm the `DESKTOP_API_BASE_URL` repository variable points to the intended API.
- Keep the workflow's automatic `DESKTOP_UPDATE_REPOSITORY` value unchanged so fork
  installers use the fork's releases instead of the upstream repository.
- Confirm the macOS signing and notarization secrets are configured.
- Review `apps/desktop/release-policy.json`. Raise `minimumSupportedVersion` only when
  older installed clients must be forced to update; it cannot exceed the release
  package version.
- Review the current limitations and full manual checklist in the
  [desktop runtime and release guide](apps/desktop/README.md#draft-release-workflow).

After the workflow succeeds, smoke-test every installer, confirm all `latest*.yml`,
blockmap, and policy assets exist, and verify checksums before manually publishing the
draft. Drafts are not visible to installed updaters. A workflow rerun may update draft
assets, but published release tags and assets must never be moved or reused.

## Adding New Features

### New Provider (Scraper, AI, etc.)

1. Define the interface in the relevant `packages/domain/src/<context>` folder.
2. Implement the adapter in the relevant `packages/infrastructure/src/<context-or-adapter>` folder.
3. Add configuration to `packages/config`.
4. Register in the composition root (`apps/desktop`).
5. Add tests for the implementation.

### New API Endpoint

1. Define the Zod schema in the relevant `packages/contracts/src/<context>` folder.
2. Create the use case in the relevant `packages/application/src/<context>` folder.
3. Add the route in the relevant `packages/api/src/<context>` folder.
4. Register the route in `packages/api/src/app.ts`.
5. Add tests.

### New Document Template

1. Create the HTML template in `packages/infrastructure/src/documents/templates`.
2. Add the template name to the renderer configuration.
3. Test with sample data.

## Questions?

Open a [GitHub Discussion](https://github.com/ErtanOzdemir/careerden/discussions) if you have questions or need help getting started.

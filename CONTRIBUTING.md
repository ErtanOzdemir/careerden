# Contributing to Link2CV

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
- [Adding New Features](#adding-new-features)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9.15+
- Docker (for PostgreSQL and Redis)
- Git

### Setup

1. **Fork** the repository on GitHub.

2. **Clone** your fork:

   ```bash
   git clone git@github.com:<your-username>/link2cv.git
   cd link2cv
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Start local services**:

   ```bash
   docker compose up -d
   ```

5. **Set up environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your API keys if needed
   ```

6. **Start development**:
   ```bash
   pnpm dev
   ```

## Development Workflow

1. Create a new branch from `main` (see [Branch Naming](#branch-naming)).
2. Make your changes in small, focused commits.
3. Write or update tests for your changes.
4. Run `pnpm typecheck` and `pnpm test` to verify.
5. Push your branch and open a pull request.

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

- [ ] Branch is up to date with `main`
- [ ] Code compiles without errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
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

### File Structure

- Keep files small and focused.
- One exported entity per file when possible.
- Follow existing naming conventions in each package.
- Organize backend code by context inside each package, such as `profiles`, `job-applications`, `scraping`, `matching`, and `documents`.

### Imports

- Use `@link2cv/*` package aliases for cross-package imports.
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
pnpm --filter @link2cv/domain test

# Run tests in watch mode
pnpm vitest --filter @link2cv/contracts
```

## Adding New Features

### New Provider (Scraper, AI, etc.)

1. Define the interface in `packages/domain`.
2. Implement the adapter in `packages/infrastructure`.
3. Add configuration to `packages/config`.
4. Register in the composition root (`apps/api` or `apps/worker`).
5. Add tests for the implementation.

### New API Endpoint

1. Define the Zod schema in the relevant `packages/contracts/src/<context>` folder.
2. Create the use case in the relevant `packages/application/src/<context>` folder.
3. Add the route in the relevant `apps/api/src/<context>` folder.
4. Register the route in `apps/api/src/app.ts`.
5. Add tests.

### New Document Template

1. Create the HTML template in `packages/infrastructure/src/documents/templates`.
2. Add the template name to the renderer configuration.
3. Test with sample data.

## Questions?

Open a [GitHub Discussion](https://github.com/ErtanOzdemir/link2cv/discussions) if you have questions or need help getting started.

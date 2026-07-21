---
name: maintain-project-docs
description: Assess and update Careerden repository documentation when implementation changes make existing guidance incomplete or stale. Use alongside changes to features, setup, commands, environment variables, APIs, architecture, package boundaries, contributor workflows, security practices, marketing runtime behavior, or other user- and contributor-visible behavior that affects README.md, CONTRIBUTING.md, AGENTS.md, package READMEs, or related Markdown documentation.
---

# Maintain Project Docs

Keep documentation accurate in the same change that alters the behavior it describes.

## Workflow

1. Inspect the requested change, `git diff`, and `git status` to determine the actual change surface. Preserve unrelated work.
2. Search existing Markdown with `rg` for the affected feature, command, configuration key, route, package, workflow, or concept.
3. Decide which documents are authoritative for the affected audience. Do not update a file merely because it mentions the topic.
4. Verify every new claim against source code, package scripts, schemas, configuration, or runtime wiring before editing.
5. Update all affected authoritative locations together. Remove or rewrite stale guidance rather than appending contradictory notes.
6. Review the final diff for consistency, runnable examples, valid relative links, and accidental duplication.
7. Run the documentation checks and repository quality gates required by `AGENTS.md`.

## Route Changes to Documents

| Change | Primary documentation |
| --- | --- |
| Product features, quick start, services, architecture overview, environment variables, public API, common commands | Root `README.md` |
| Local setup, development workflow, branch and commit rules, pull requests, coding standards, testing, extension guides | `CONTRIBUTING.md` |
| Agent-facing stack facts, naming, architecture decisions, runtime validation, required gates | `AGENTS.md` |
| App- or package-specific setup and behavior | The nearest maintained `README.md` |
| Vulnerability reporting, supported versions, security expectations | `SECURITY.md` |
| Community conduct and enforcement policy | `CODE_OF_CONDUCT.md` |
| Marketing runtime configuration and routes | `apps/marketing/README.md` |
| Unresolved launch, ownership, privacy, or legal inputs | `apps/marketing/LEGAL_PLACEHOLDERS.md` |

Treat dated files under `docs/superpowers/plans` and `docs/superpowers/specs` as design history unless the user explicitly asks to revise them or the repository clearly treats a specific file as a living specification.

## Impact Rules

- Update docs when a user or contributor would otherwise run the wrong command, set the wrong variable, call the wrong endpoint, misunderstand current behavior, place code in the wrong layer, or miss a required step.
- Update duplicated facts everywhere they are intentionally maintained. Common overlaps include prerequisites and setup in `README.md` and `CONTRIBUTING.md`, and quality gates or architectural conventions in `README.md`, `CONTRIBUTING.md`, and `AGENTS.md`.
- Keep audience boundaries clear: explain how to use the project in `README.md`, how to change it in `CONTRIBUTING.md`, and how coding agents must operate in `AGENTS.md`.
- Prefer links to one authoritative explanation over copying a long procedure into several files.
- Preserve the document's existing voice, heading hierarchy, formatting, and level of detail.
- Document current, verified behavior. Do not promise planned functionality or infer defaults that the code does not establish.
- Use exact package names, file paths, script names, environment keys, endpoint paths, and supported values from the repository.
- Include migration or compatibility guidance when a public command, configuration key, endpoint, or workflow changes incompatibly.
- If the change has no documentation impact, leave docs untouched and state that conclusion in the handoff with the evidence checked.

## Verification

- Re-read edited sections together with nearby text and any table of contents.
- Check referenced local paths and anchors; use `rg --files` to confirm file targets.
- Validate command examples against the owning `package.json` and configuration examples against their schemas or loaders.
- Run Prettier on each edited Markdown file with `pnpm exec prettier <files> --check`.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` as required by `AGENTS.md`.
- Run `pnpm test` when the accompanying change affects behavior, contracts, persistence, queues, scraping, rendering, or AI integration.
- Report any skipped or failing gate precisely; do not weaken documentation to make an unverified command appear valid.

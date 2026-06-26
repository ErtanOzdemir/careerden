# URL Save-First Desktop Scrape Handoff

**Goal:** When a user pastes a LinkedIn job URL, save the job to Postgres first, then let the desktop app claim queued work from the API, scrape it locally, and send the scraped bundle back to the API for AI matching and document generation.

## Summary

The current desired flow is API-first for persistence and desktop-first for scraping. The browser or desktop UI should create the job row immediately in the API database. The desktop app then polls the API for queued, unclaimed jobs, claims them atomically, processes them in its internal queue, runs LinkedIn scraping, and sends the resulting `ScrapeBundle` back to the API. The API stores the scrape result and continues the existing AI matching and document generation pipeline.

This keeps Postgres as the source of truth, avoids losing pasted URLs, and prevents the worker from starting AI analysis before the desktop scrape exists.

## Target Flow

1. User pastes a LinkedIn job URL in the app.
2. The app calls the API to create the job row in Postgres.
3. The row is saved with `queued` status and remains visible in the UI.
4. The desktop app polls the API for `queued` jobs that have not been claimed yet.
5. Desktop atomically claims a batch of jobs so the same job is not picked up twice.
6. Claimed jobs are added to the desktop app's internal queue.
7. Desktop scrapes the LinkedIn job, company, and related pages.
8. Desktop sends the scraped bundle back to the API.
9. API stores the scrape bundle, updates the job state, and starts AI matching.
10. AI matching and document generation continue on the API side as they do today.

## Implementation Notes

- Keep `queued` as the visible waiting state.
- Add an API claim endpoint for desktop polling, with atomic claim semantics.
- Do not enqueue AI matching from the plain quick-add path before a scrape bundle exists.
- Preserve the existing desktop scraping/session handling, but route its output back through the API instead of treating the desktop process as the source of truth.
- Keep the API and desktop responsibilities separate:
  - API owns persistence, job claim state, scrape bundle storage, AI matching, and document generation.
  - Desktop owns LinkedIn session handling, scraping, and local internal queue execution.

## Acceptance Criteria

- Pasting a LinkedIn URL always creates a Postgres row first.
- The created job appears as `queued` until the desktop claims it.
- The desktop can restart and continue polling without duplicating already claimed jobs.
- After scraping completes, the API receives the scraped bundle and advances the job into the AI pipeline.
- A job without a desktop scrape bundle never gets stuck in `queued` because of an AI worker failure.

## Assumptions

- Desktop auto-polls while the app is open.
- `queued` means "saved and waiting to be claimed by desktop", not "already being processed by AI".
- Manual tracker entries that are not meant for scraping stay as non-queued application records.
- The existing AI matching and document generation flow stays on the API side.

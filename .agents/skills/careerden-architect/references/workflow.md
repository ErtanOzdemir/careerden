# Workflow

## Job Submission and Desktop Scraping

1. The API validates submission and creates a `queued` job application through an application use case.
2. The Electron desktop worker authenticates, claims eligible queued or expired scraping work, and receives a time-limited claim.
3. The desktop worker heartbeats while site adapters fetch and parse public guest job and company responses.
4. The desktop submits the raw/normalized scrape bundle with its claim identity.
5. The application layer validates status and claim ownership, stores the scrape and optional logo, updates tracking fields, emits events, and transitions to `scraped`.
6. If the profile enables automatic analysis, enqueue the LLM job; otherwise emit an explicit skipped event.

Manual tracker entries create a deterministic manual scrape bundle and transition directly to `scraped`. Desktop `from-scrape` submissions persist supplied scrape data and follow the same analysis preference.

## Scrape Claims and Failures

- Claim duration is explicit; expired `scraping` claims are reclaimable.
- Increment scrape attempts on claim and persist retry scheduling/backoff through the repository.
- Reject another desktop's claim with a typed conflict.
- Local scraper failures call the API failure operation. Terminal API submission responses are not reported through a second failure request.
- Preserve failure reason and processing events for scheduled retries and final failures.

## LLM Analysis

1. `apps/llm-worker` consumes the job-application queue.
2. The analysis use case loads the owned profile and stored scrape bundle, validates prerequisites/transitions, and calls provider-neutral matching operations.
3. Validate structured AI output before persistence.
4. Save match analysis, emit events, and transition to review-ready/failure states explicitly.

## Documents

- Keep editable document content separate from rendered artifacts.
- Generate deterministic render inputs from profile, scrape, analysis, selected content, and template mappings.
- Keep DOCX template extraction/rendering, HTML rendering, PDF conversion, storage, and signed URLs behind interfaces.
- Treat generation status changes and events as application behavior; treat rendering/storage implementations as infrastructure.

## Follow-ups and Notifications

- Follow-up create/update/delete use cases own reminder scheduling, replacement, and cancellation.
- Keep the reminder lead time as a domain policy.
- `apps/notifications-worker` creates notifications for valid reminders, marks delivery state, and periodically rebuilds missing delayed jobs.
- Recovery overlap guards and timers belong to the worker runtime.

## Status and Retry Rules

- Use the domain transition policy for `queued`, `scraping`, `scraped`, `analyzing`, `review_ready`, `generating_documents`, `completed`, and `failed`.
- Persist a failure reason and event whenever processing becomes failed.
- Retry only through explicit use cases/queue adapters. Typed application failures are terminal in BullMQ; unexpected infrastructure/provider failures retain configured attempts and backoff.

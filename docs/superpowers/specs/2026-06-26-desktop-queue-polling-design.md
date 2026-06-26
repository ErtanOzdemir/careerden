# Desktop Queue Polling Design

## Overview

Decouple LinkedIn scraping from the web UI. Job applications are created instantly in
the API database with status `queued`. The desktop app polls for queued jobs, scrapes
them asynchronously, and posts results back. The BullMQ worker handles AI analysis.

## Status Flow

```
queued → scraping → scraped → analyzing → review_ready → generating_documents → completed
```

- `queued`: created via web UI, waiting for desktop to pick it up
- `scraping`: desktop is actively scraping this job
- `scraped`: scraped data saved to API, enqueued for BullMQ AI analysis
- `analyzing` → `review_ready` → etc.: existing BullMQ worker flow (unchanged)

## API Changes

### Remove `shouldProcess` from POST /job-applications
Every job with a `sourceUrl` gets status `queued`. Jobs without a URL get
`completed`.

### New: PUT /job-applications/:id/status
Body: `{ status: "scraping" | "scraped" | ... }`
Used by desktop to transition status when scrape begins/completes.

### New: PUT /job-applications/:id/scrape-data
Body: `{ scrapeBundle: ApiScrapeBundle }`
Sets status to `scraped`, saves bundle, enqueues `jobApplicationId` to BullMQ.

### Existing: GET /job-applications?status=queued
Used by desktop poller to find jobs waiting to be scraped.

## Desktop Poller (New: scraping-queue-poller.ts)

Runs in Electron main process on a 30s `setInterval`:
1. `GET /api/job-applications?status=queued`
2. For each job: `PUT /status` → `scraping`, scrape via Playwright, `PUT /scrape-data`
3. Uses Node 22 global `fetch` for API calls
4. Starts on app `ready`, stops on `will-quit`

## Web UI Changes (ApplicationsLog.tsx)

`handleQuickAdd` — always calls `jobApplicationsApi.create()`. No more
`window.electronAPI` branching. The `createFromScrape` method is no longer called
from the UI but the endpoint stays for the desktop poller.

## Workflow Status Domain Changes

Add `"scraping"` and `"scraped"` to `WorkflowStatus`.
Allowed transitions:
- `queued → scraping` (desktop picks up)
- `scraping → scraped` (data saved)
- `scraping → failed` (scrape error)
- `scraped → analyzing` (BullMQ worker starts)
- All other transitions unchanged.

## Files Changed

| File | Change |
|---|---|
| `apps/api/src/job-applications/job-applications.routes.ts` | Add PUT status + PUT scrape-data; simplify POST / |
| `apps/api/src/job-applications/analyze-scraped-job.worker.ts` | Start from `scraped` not `queued` |
| `apps/api/src/app.ts` | Wire new routes |
| `apps/web/src/pages/ApplicationsLog.tsx` | Simplify handleQuickAdd |
| `apps/web/src/api/jobApplications.ts` | Add `updateStatus`, `submitScrapeData` methods |
| `apps/desktop/src/main/scraping-queue-poller.ts` | **New** — polling loop |
| `apps/desktop/src/main/ipc-handlers.ts` | Register poller lifecycle |
| `apps/desktop/src/main/index.ts` | Start/stop poller |
| `packages/domain/src/job-applications/workflow-status.ts` | Add `scraping`, `scraped` statuses + transitions |
| `packages/domain/src/job-applications/job-application.ts` | Update `JobApplication` entity if needed |
| `packages/domain/src/job-applications/workflow-status.test.ts` | Update tests |
| `packages/application/src/job-applications/submit-job-application.ts` | Remove `shouldProcess` |
| `packages/contracts/src/job-applications/job-application.schema.ts` | Remove `shouldProcess` from schema |

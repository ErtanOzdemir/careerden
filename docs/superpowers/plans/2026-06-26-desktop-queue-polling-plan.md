# Desktop Queue Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple LinkedIn scraping from the web UI by polling for queued jobs in the desktop app and processing them asynchronously.

**Architecture:** Job applications are created instantly via API with status `queued`. The Electron desktop main process polls for queued jobs, scrapes them via Playwright, and posts results back. A BullMQ worker handles AI analysis starting from the `scraped` status. A `shouldProcess` flag is replaced by `sourceUrl` presence to determine the initial status.

**Tech Stack:** Express, BullMQ, Electron, Playwright, Zod, Knex (Postgres), Vitest

## Global Constraints

- All TypeScript imports use `.js` extension (ESM with NodeNext)
- Variables prefixed with `_` when intentionally unused
- Files use kebab-case naming
- Tests colocated with source and use `*.test.ts`
- All existing tests must continue to pass after changes

---

### Task 1: Domain — Add `scraped` status to workflow

**Files:**
- Modify: `packages/domain/src/job-applications/workflow-status.ts`
- Test: `packages/domain/src/job-applications/workflow-status.test.ts`

**Interfaces:**
- Consumes: `JobApplicationStatus` union type, `canTransitionJobApplicationStatus()` function
- Produces: Updated `JobApplicationStatus` including `"scraped"`, updated allowed transitions

- [ ] **Step 1: Add `"scraped"` to the statuses array and update allowed transitions**

In `workflow-status.ts`, update the transitions for `scraping` and add `scraped`:

```typescript
export const jobApplicationStatuses = [
  "queued",
  "scraping",
  "scraped",
  "analyzing",
  "review_ready",
  "generating_documents",
  "completed",
  "failed",
] as const;

export type JobApplicationStatus = (typeof jobApplicationStatuses)[number];

const allowedTransitions: Record<JobApplicationStatus, JobApplicationStatus[]> = {
  queued: ["scraping", "failed"],
  scraping: ["scraped", "failed"],
  scraped: ["analyzing", "scraping", "failed"],
  analyzing: ["review_ready", "failed"],
  review_ready: ["generating_documents", "failed"],
  generating_documents: ["completed", "failed"],
  completed: ["generating_documents"],
  failed: [],
};
```

Key changes:
- Add `"scraped"` between `"scraping"` and `"analyzing"`
- `scraping → scraped` (desktop completes scrape)
- `scraped → analyzing` (BullMQ worker starts AI)
- `scraped → scraping` (retry if scrape failed)
- `scraped → failed` (fallback)

- [ ] **Step 2: Update the test to include the new transition**

In `workflow-status.test.ts`, update the happy-path test:

```typescript
it("allows the happy-path worker transitions", () => {
  expect(canTransitionJobApplicationStatus("queued", "scraping")).toBe(true);
  expect(canTransitionJobApplicationStatus("scraping", "scraped")).toBe(true);
  expect(canTransitionJobApplicationStatus("scraped", "analyzing")).toBe(true);
  expect(canTransitionJobApplicationStatus("analyzing", "review_ready")).toBe(true);
  expect(canTransitionJobApplicationStatus("review_ready", "generating_documents")).toBe(true);
  expect(canTransitionJobApplicationStatus("generating_documents", "completed")).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify**

```bash
pnpm --filter @link2cv/domain test -- packages/domain/src/job-applications/workflow-status.test.ts
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/domain/src/job-applications/workflow-status.ts packages/domain/src/job-applications/workflow-status.test.ts
git commit -m "feat(domain): add scraped workflow status"
```

---

### Task 2: Domain — Remove `shouldProcess` from `CreateJobApplicationInput`

**Files:**
- Modify: `packages/domain/src/job-applications/job-application.ts`

**Interfaces:**
- Consumes: `CreateJobApplicationInput` interface
- Produces: `CreateJobApplicationInput` without `shouldProcess` field

- [ ] **Step 1: Remove `shouldProcess` from the interface**

In `job-application.ts`, delete the `shouldProcess?: boolean;` line from `CreateJobApplicationInput`:

```typescript
export interface CreateJobApplicationInput extends Partial<
  Pick<
    JobApplicationTrackingFields,
    | "companyName"
    | "roleTitle"
    | "roleType"
    | "dateApplied"
    | "applicationStatus"
    | "priority"
    | "tags"
    | "nextFollowUpAt"
    | "lastResponseAt"
    | "metadata"
  >
> {
  profileId: string;
  sourceUrl?: string;
  jobUrl?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/domain/src/job-applications/job-application.ts
git commit -m "feat(domain): remove shouldProcess from CreateJobApplicationInput"
```

---

### Task 3: Infrastructure — Update repositories to use `sourceUrl` for initial status

**Files:**
- Modify: `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.ts`
- Modify: `packages/infrastructure/src/persistence/job-applications/sqlite-job-application.repository.ts`
- Modify: `packages/infrastructure/src/persistence/job-applications/postgres-job-application.repository.ts`

**Interfaces:**
- Consumes: `CreateJobApplicationInput` (no `shouldProcess`)
- Produces: Repository `create()` sets status based on `input.sourceUrl` presence instead of `input.shouldProcess`

- [ ] **Step 1: Update in-memory repository**

In `in-memory-job-application.repository.ts`, change the status assignment in `create()`:

Before:
```typescript
status: input.shouldProcess ? "queued" : "completed",
// ...
title: input.shouldProcess ? "LinkedIn job submitted" : "Application created",
```

After:
```typescript
status: input.sourceUrl ? "queued" : "completed",
// ...
title: input.sourceUrl ? "LinkedIn job submitted" : "Application created",
```

- [ ] **Step 2: Update SQLite repository**

In `sqlite-job-application.repository.ts`, same changes as Step 1.

- [ ] **Step 3: Update Postgres repository**

Search for `shouldProcess` in `postgres-job-application.repository.ts` and apply the same pattern.

- [ ] **Step 4: Run existing tests to verify**

```bash
pnpm --filter @link2cv/infrastructure test
```

- [ ] **Step 5: Commit**

```bash
git add packages/infrastructure/src/persistence/job-applications/
git commit -m "feat(infra): use sourceUrl presence instead of shouldProcess for initial status"
```

---

### Task 4: Application — Remove `shouldProcess` from test

**Files:**
- Modify: `packages/application/src/job-applications/process-job-application.test.ts`

- [ ] **Step 1: Remove `shouldProcess: true` from test inputs**

Find and remove all `shouldProcess: true,` lines in `process-job-application.test.ts`.

- [ ] **Step 2: Run tests to verify**

```bash
pnpm --filter @link2cv/application test
```

- [ ] **Step 3: Commit**

```bash
git add packages/application/src/job-applications/process-job-application.test.ts
git commit -m "test(application): remove shouldProcess from test fixture"
```

---

### Task 5: API — Add `PUT /:id/status` and `PUT /:id/scrape-data` routes

**Files:**
- Modify: `apps/api/src/job-applications/job-applications.routes.ts`
- Modify (if needed): `packages/contracts/src/job-applications/job-application.schema.ts`

**Interfaces:**
- Consumes: `job-applications.routes.ts` dependencies (`jobApplications`, `queue`, etc.)
- Produces: Two new routes, updated `from-scrape` endpoint

- [ ] **Step 1: Add Zod schemas for the new endpoints**

In `job-application.schema.ts`, add new schemas:

```typescript
export const updateStatusSchema = z.object({
  status: z.enum(["queued", "scraping", "scraped", "analyzing", "review_ready", "generating_documents", "completed", "failed"]),
});

export const submitScrapeDataSchema = z.object({
  scrapeBundle: scrapeBundleSchema,
});
```

- [ ] **Step 2: Add `PUT /:id/status` route**

In `job-applications.routes.ts`, add between the `router.param` and the `router.get("/stream")`:

```typescript
router.put("/:id/status", validateBody(updateStatusSchema), async (request, response, next) => {
  try {
    const jobApplication = await dependencies.jobApplications.findById(request.params.id);

    if (!jobApplication) {
      response.status(404).json({ error: "Job application not found" });
      return;
    }

    const updated = await dependencies.jobApplications.updateStatus(
      request.params.id,
      request.body.status,
    );

    await dependencies.jobApplications.addEvent({
      jobApplicationId: request.params.id,
      type: "processing",
      title: `Status changed to ${request.body.status}`,
    });

    response.json(updated);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 3: Add `PUT /:id/scrape-data` route**

In `job-applications.routes.ts`, add:

```typescript
router.put("/:id/scrape-data", validateBody(submitScrapeDataSchema), async (request, response, next) => {
  try {
    const jobApplication = await dependencies.jobApplications.findById(request.params.id);

    if (!jobApplication) {
      response.status(404).json({ error: "Job application not found" });
      return;
    }

    const scrape = request.body.scrapeBundle as ScrapeBundle;
    await dependencies.jobApplications.saveScrapeBundle(request.params.id, scrape);
    await dependencies.jobApplications.updateStatus(request.params.id, "scraped");
    await dependencies.jobApplications.addEvent({
      jobApplicationId: request.params.id,
      type: "processing",
      title: "Desktop scrape received",
      metadata: {
        companyName: scrape.job.companyName,
        roleTitle: scrape.job.title,
      },
    });
    await dependencies.queue.enqueue({ jobApplicationId: request.params.id });

    const updated = await dependencies.jobApplications.findById(request.params.id);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 4: Run tests to verify existing behavior**

```bash
pnpm --filter @link2cv/api-app test
```
Expected: Existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/job-applications/job-applications.routes.ts packages/contracts/src/job-applications/job-application.schema.ts
git commit -m "feat(api): add PUT status and PUT scrape-data endpoints"
```

---

### Task 6: API — Update `from-scrape` endpoint to set `scraped` status

**Files:**
- Modify: `apps/api/src/job-applications/job-applications.routes.ts`

**Rationale:** The `from-scrape` endpoint creates a job application with scraped data already available. After saving the bundle, it should set status to `scraped` (scraping already done) before enqueuing to BullMQ. Currently it sets status to `queued` via `shouldProcess: true`, but the BullMQ worker will now start from `scraped`.

- [ ] **Step 1: Add `updateStatus(id, "scraped")` call**

In the `POST /from-scrape` handler, after `saveScrapeBundle` and before `queue.enqueue`, add:

```typescript
await dependencies.jobApplications.updateStatus(jobApplication.id, "scraped");
```

The full sequence becomes:
1. Create with `sourceUrl` → status "queued" (automatic from Task 3)
2. Save scrape bundle
3. Update status to "scraped" (scraping complete)
4. Enqueue to BullMQ

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @link2cv/api-app test
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/job-applications/job-applications.routes.ts
git commit -m "feat(api): set scraped status in from-scrape before enqueue"
```

---

### Task 7: API — Modify BullMQ worker to start from `scraped`

**Files:**
- Modify: `apps/api/src/job-applications/analyze-scraped-job.worker.ts`

**Interfaces:**
- Consumes: Jobs enqueued from `PUT /:id/scrape-data` and `POST /from-scrape`
- Produces: Worker processes AI analysis starting from `scraped` status

- [ ] **Step 1: Remove the `queued → scraping` transition at the start of the worker**

The worker currently does:
```typescript
await input.jobApplications.updateStatus(jobApplication.id, "scraping");
await input.jobApplications.addEvent({ ... "Desktop scrape saved" ... });
await input.jobApplications.updateStatus(jobApplication.id, "analyzing");
```

Replace with just the transition to `analyzing` — the desktop already set status to `scraped`:

```typescript
await input.jobApplications.addEvent({
  jobApplicationId: jobApplication.id,
  type: "processing",
  title: "AI analysis started",
});
await input.jobApplications.updateStatus(jobApplication.id, "analyzing");
```

- [ ] **Step 2: Run typecheck to verify**

```bash
pnpm --filter @link2cv/api-app typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/job-applications/analyze-scraped-job.worker.ts
git commit -m "fix(api): start AI worker from scraped status, remove redundant scraping transition"
```

---

### Task 8: Web — Add API client methods

**Files:**
- Modify: `apps/web/src/api/jobApplications.ts`

**Interfaces:**
- Consumes: Existing `requestJson` client
- Produces: `updateStatus()` and `submitScrapeData()` methods on the API client

- [ ] **Step 1: Add new interface types**

In `jobApplications.ts`, add:

```typescript
export interface UpdateStatusInput {
  status: string;
}

export interface SubmitScrapeDataInput {
  scrapeBundle: ApiScrapeBundle;
}
```

- [ ] **Step 2: Add methods to the API client object**

```typescript
updateStatus(id: string, input: UpdateStatusInput): Promise<ApiJobApplication> {
  return requestJson<ApiJobApplication>(`/job-applications/${id}/status`, {
    method: "PUT",
    body: input,
  });
},

submitScrapeData(id: string, input: SubmitScrapeDataInput): Promise<ApiJobApplication> {
  return requestJson<ApiJobApplication>(`/job-applications/${id}/scrape-data`, {
    method: "PUT",
    body: input,
  });
},
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @link2cv/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/jobApplications.ts
git commit -m "feat(web): add updateStatus and submitScrapeData API methods"
```

---

### Task 9: Web — Simplify `handleQuickAdd` in ApplicationsLog

**Files:**
- Modify: `apps/web/src/pages/ApplicationsLog.tsx`

**Interfaces:**
- Consumes: `jobApplicationsApi.create()` method
- Produces: Simplified `handleQuickAdd` that always uses the simple create path

- [ ] **Step 1: Remove the Electron scraping branch**

Replace the current `handleQuickAdd` logic:

```typescript
async function handleQuickAdd() {
  try {
    setIsSaving(true);
    setError(null);

    if (!profileId) {
      throw new Error("Profile is not ready yet.");
    }

    const trimmedSourceUrl = sourceUrl.trim();
    const created = await jobApplicationsApi.create({
      profileId,
      sourceUrl: trimmedSourceUrl || undefined,
    });

    setApplications((current) => [mapApiJobApplicationToUi(created), ...current]);
    setSourceUrl("");
  } catch (saveError) {
    setError(saveError instanceof Error ? saveError.message : "Failed to create application.");
  } finally {
    setIsSaving(false);
  }
}
```

Changes:
- Always call `jobApplicationsApi.create()` — no `window.electronAPI` check
- Remove `createFromScrape` import usage
- The async scraping happens via the desktop poller

- [ ] **Step 2: Remove unused imports**

Check if `ApiScrapeBundle` and `CreateJobApplicationFromScrapeInput` imports are still used elsewhere. If not, remove them.

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @link2cv/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ApplicationsLog.tsx
git commit -m "feat(web): simplify handleQuickAdd to always use simple create"
```

---

### Task 10: API — Add `processingStatus` filter to list endpoint

**Files:**
- Modify: `packages/contracts/src/job-applications/job-application.schema.ts`

**Rationale:** The web app's poller (running in Electron) needs to filter job applications by processing status to find queued jobs awaiting scraping.

- [ ] **Step 1: Add `processingStatus` to `listJobApplicationsQuerySchema`**

In `job-application.schema.ts`, add to the existing schema:

```typescript
export const listJobApplicationsQuerySchema = z.object({
  profileId: z.string().min(1),
  processingStatus: z.enum([
    "queued", "scraping", "scraped", "analyzing",
    "review_ready", "generating_documents", "completed", "failed",
  ]).optional(),
  applicationStatus: applicationStatusSchema.optional(),
  // ... rest unchanged
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/src/job-applications/job-application.schema.ts
git commit -m "feat(contracts): add processingStatus filter to list query"
```

---

### Task 11: Web — Add background scraping poller hook

**Files:**
- Create: `apps/web/src/hooks/useScrapingQueuePoller.ts`

**Rationale:** The web app running inside Electron (`window.electronAPI` is available) already has the user's session cookie and can call the API with full auth. A React hook polls for queued jobs, uses the existing IPC bridge to scrape via the desktop's Playwright, and saves results through the API. This avoids adding auth handling to the Electron main process.

- [ ] **Step 1: Create the hook module**

`apps/web/src/hooks/useScrapingQueuePoller.ts`:

```typescript
import { useEffect, useRef } from "react";
import { jobApplicationsApi } from "../api/jobApplications.js";
import type { ApiScrapeBundle } from "../api/types.js";

const POLL_INTERVAL_MS = 30_000;

export function useScrapingQueuePoller(profileId: string | null): void {
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!profileId || !window.electronAPI) {
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    async function poll(): Promise<void> {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        const jobs = await jobApplicationsApi.list({
          profileId,
          processingStatus: "queued" as const,
        });

        for (const job of jobs) {
          if (stopped || !job.sourceUrl) {
            continue;
          }

          try {
            await jobApplicationsApi.updateStatus(job.id, { status: "scraping" });

            const scrapeBundle = (await window.electronAPI!.scrapeLinkedInJob(
              job.sourceUrl,
            )) as ApiScrapeBundle;

            await jobApplicationsApi.submitScrapeData(job.id, { scrapeBundle });
          } catch (error) {
            console.error(`[ScrapingPoller] Error scraping job ${job.id}:`, error);
            await jobApplicationsApi.updateStatus(job.id, { status: "failed" });
          }
        }
      } catch (error) {
        console.error("[ScrapingPoller] Poll error:", error);
      } finally {
        isPollingRef.current = false;
      }
    }

    timer = setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [profileId]);
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @link2cv/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useScrapingQueuePoller.ts
git commit -m "feat(web): add scraping queue poller hook for Electron"
```

---

### Task 12: Web — Wire poller and add processingStatus to API client

**Files:**
- Modify: `apps/web/src/pages/ApplicationsLog.tsx`
- Modify: `apps/web/src/api/jobApplications.ts`

- [ ] **Step 1: Add `processingStatus` to `ListJobApplicationsParams`**

In `apps/web/src/api/jobApplications.ts`, add to the interface:

```typescript
export interface ListJobApplicationsParams {
  processingStatus?: string;
  applicationStatus?: ApiApplicationStatus;
  // ... rest unchanged
}
```

- [ ] **Step 2: Wire the polling hook in `ApplicationsLog.tsx`**

Add the import:

```typescript
import { useScrapingQueuePoller } from "../hooks/useScrapingQueuePoller.js";
```

Add the hook call after `useJobApplicationChanges`:

```typescript
useJobApplicationChanges(profileId ?? undefined, {
  onChange: handleRealtimeChange,
  onOpen: () => loadApplications(false),
});

useScrapingQueuePoller(profileId);
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @link2cv/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ApplicationsLog.tsx apps/web/src/api/jobApplications.ts
git commit -m "feat(web): wire scraping queue poller and add processingStatus filter"
```

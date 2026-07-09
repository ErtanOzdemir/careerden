# Multiple Follow-Ups Per Job Application

## Problem

The current follow-up system stores a single `next_follow_up_at` timestamp column on
`job_applications`. Adding a new follow-up overwrites the previous one. There is no history of
past follow-ups, no per-follow-up title or description, and only one reminder can be pending at a
time.

## Decision

Replace the single follow-up column with a dedicated `job_application_follow_ups` table that has a
one-to-many relationship to `job_applications`. Each follow-up is a separate row with its own
title, description, scheduled date, and independent reminder state. Full CRUD. Follow-ups remain
visible after their reminder is sent, building a history per application.

## Approach Chosen

**Approach A: Dedicated `job_application_follow_ups` table.** Matches the existing sub-resource
pattern used by `job_application_contacts` and `job_application_events`. Each follow-up has
independent reminder scheduling state. No race conditions on concurrent updates.

Rejected alternatives:

- **JSONB array column on `job_applications`** — race conditions on concurrent updates, hard to
  query for reminder recovery, doesn't match existing patterns.
- **Reuse `job_application_events` with type `follow_up`** — events are append-only/immutable but
  follow-ups need full CRUD (edit title/description/date). Wrong model.

## Design

### 1. Database Schema

New table:

```sql
CREATE TABLE job_application_follow_ups (
  id                      TEXT PRIMARY KEY,
  job_application_id      TEXT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  profile_id              TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  scheduled_at            TIMESTAMPTZ NOT NULL,
  reminder_job_id         TEXT,
  reminder_scheduled_for  TIMESTAMPTZ,
  reminder_sent_at        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_job_app
  ON job_application_follow_ups(job_application_id);

CREATE INDEX idx_follow_ups_reminder_recovery
  ON job_application_follow_ups(reminder_scheduled_for, reminder_sent_at)
  WHERE reminder_sent_at IS NULL;

CREATE INDEX idx_follow_ups_profile_upcoming
  ON job_application_follow_ups(profile_id, scheduled_at)
  WHERE reminder_sent_at IS NULL;
```

`profile_id` is stored on the follow-up row directly so the notifications worker can validate
ownership and email preferences without an extra join (the current reminder repo already joins to
`user_profiles`).

Migration is two-phase:

1. Create the new table.
2. Migrate existing `next_follow_up_at` data into it — one follow-up row per application that has
   a date, carrying over the existing `follow_up_reminder_job_id`,
   `follow_up_reminder_scheduled_for`, and `follow_up_reminder_sent_at` values. The migrated
   follow-up gets a default title ("Follow-up") and no description.
3. Drop the old columns from `job_applications`: `next_follow_up_at`,
   `follow_up_reminder_job_id`, `follow_up_reminder_scheduled_for`, `follow_up_reminder_sent_at`.
4. Drop the old index `idx_job_applications_follow_up_reminder`.

### 2. Domain Model

New file: `packages/domain/src/job-applications/job-application-follow-up.ts`

```typescript
export interface JobApplicationFollowUp {
  id: string;
  jobApplicationId: string;
  profileId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  reminderJobId?: string;
  reminderScheduledFor?: Date;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationFollowUpInput {
  jobApplicationId: string;
  profileId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
}

export interface UpdateJobApplicationFollowUpInput {
  title?: string;
  description?: string | null;
  scheduledAt?: Date;
}
```

Changes to existing domain types:

- `JobApplicationTrackingFields` — remove `nextFollowUpAt`, `followUpReminderJobId`,
  `followUpReminderScheduledFor`, `followUpReminderSentAt`.
- `CreateJobApplicationInput` — remove `nextFollowUpAt`.
- `UpdateJobApplicationTrackingInput` — remove `nextFollowUpAt`.

Changes to `FollowUpReminderQueuePayload` — add `followUpId` so the worker can locate the exact
follow-up row:

```typescript
export interface FollowUpReminderQueuePayload {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: string;
  scheduledFor: string;
}
```

Changes to `ScheduleFollowUpReminderInput` — add `followUpId`:

```typescript
export interface ScheduleFollowUpReminderInput {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: Date;
  scheduledFor: Date;
}
```

Changes to `FollowUpReminderRepository` — methods now key by `followUpId`:

```typescript
export interface FollowUpReminderRepository {
  setSchedule(followUpId: string, input: UpdateFollowUpReminderScheduleInput): Promise<void>;
  clearSchedule(followUpId: string): Promise<void>;
  findValidReminder(input: FollowUpReminderQueuePayload): Promise<FollowUpReminderCandidate | null>;
  listPendingForRecovery(now: Date): Promise<FollowUpReminderCandidate[]>;
  markSent(input: FollowUpReminderQueuePayload, sentAt: Date): Promise<boolean>;
}
```

Changes to `FollowUpReminderCandidate`:

```typescript
export interface FollowUpReminderCandidate {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  profileEmail: string;
  companyName?: string;
  roleTitle?: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  reminderJobId?: string;
  reminderScheduledFor?: Date;
  reminderSentAt?: Date;
}
```

Changes to `NotificationEmailSender` — `sendFollowUpReminder` gains `title` and `description`:

```typescript
export interface NotificationEmailSender {
  sendFollowUpReminder(input: {
    email: string;
    companyName?: string;
    roleTitle?: string;
    followUpAt: Date;
    title: string;
    description?: string;
  }): Promise<void>;
}
```

`JobApplicationRepository` — add follow-up CRUD methods (following the contacts pattern):

```typescript
  createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp>;
  findFollowUpById(id: string): Promise<JobApplicationFollowUp | null>;
  listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]>;
  updateFollowUp(id: string, input: UpdateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp>;
  deleteFollowUp(id: string): Promise<void>;
```

Export the new domain file from `packages/domain/src/index.ts`.

### 3. Repository Implementations

**Postgres (`knex-job-application.repository.ts`):** Add follow-up CRUD methods following the
contacts pattern — insert with `randomUUID()`, query by `job_application_id`, update by id, delete
by id. New mapper `toJobApplicationFollowUp` in `mappers.ts`. Remove the old `next_follow_up_at` /
`follow_up_reminder_*` column reads/writes from `toJobApplication` and the create/update tracking
methods.

**Postgres follow-up reminder repository (`follow-up-reminder.repository.ts`):** Rewrite all
queries to target `job_application_follow_ups` instead of `job_applications`. `findValidReminder`
matches by `follow_up_id` + `scheduled_at` + `reminder_scheduled_for`. `listPendingForRecovery`
queries the new table where `reminder_sent_at IS NULL` and schedules are stale or missing.
`markSent` updates by `follow_up_id`. Join to `user_profiles` for email and
`follow_up_reminders_enabled` check.

**In-memory repository:** Add a `Map<string, JobApplicationFollowUp[]>` following the
contacts/events pattern. Remove `nextFollowUpAt` from the tracking fields in create/update.

**BullMQ queue (`bullmq-follow-up-reminder.queue.ts`):** Job ID changes from
`${jobApplicationId}:follow-up:${followUpAt}` to `follow-up:${followUpId}` so each follow-up has a
unique, removable queue job. Payload includes `followUpId`.

### 4. API Routes and Contracts

New contracts in `job-application.schema.ts`:

```typescript
export const createJobApplicationFollowUpSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  scheduledAt: z.coerce.date(),
});

export const updateJobApplicationFollowUpSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  scheduledAt: z.coerce.date().optional(),
});
```

Remove `nextFollowUpAt` from `createJobApplicationSchema` and `updateJobApplicationSchema`.

New routes (following the contacts pattern):

- `POST /:id/follow-ups` — create follow-up, schedule reminder, add "reminder" event.
- `GET /:id/follow-ups` — list follow-ups.
- `PATCH /:id/follow-ups/:followUpId` — update follow-up; if `scheduledAt` changed, reschedule
  reminder (remove old queue job, enqueue new).
- `DELETE /:id/follow-ups/:followUpId` — delete follow-up, remove queued reminder job if present.

`getJobApplicationDetail` — add `listFollowUps` to the response, so the detail endpoint returns
`followUps: JobApplicationFollowUp[]` alongside `events` and `contacts`.

`scheduleFollowUpReminder` helper — rewritten to accept a `followUp` object instead of a
`jobApplication`. Called on create and on update (when date changes). On delete, remove the queue
job; no DB clear needed because the row is gone.

The `POST /` and `PATCH /:id` routes no longer schedule follow-up reminders — that logic moves
entirely to the new follow-up routes.

### 5. Notifications Worker

`apps/notifications-worker/src/app.ts`:

1. `reminders.findValidReminder(job.data)` — now queries `job_application_follow_ups` by
   `follow_up_id`, validates `scheduledAt` and `reminderScheduledFor` still match (same staleness
   check as before, just keyed on follow-up row).
2. Email body now includes the follow-up's `title` and `description` —
   `emailSender.sendFollowUpReminder` receives `title` and `description` from the candidate.
3. `notifications.create` uses the follow-up `title` as the notification title, `description` as
   the body.
4. `reminders.markSent` updates `reminder_sent_at` on the follow-up row.

`recoverPendingReminders` — queries `listPendingForRecovery` which now reads from
`job_application_follow_ups`. For each pending follow-up, enqueues a reminder job with `followUpId`
in the payload, then calls `setSchedule(followUpId, ...)`.

Email sender (`smtp-notification-email.sender.ts`): `sendFollowUpReminder` signature gains `title`
and `description` params. Email subject becomes `Follow-up reminder: ${title}` (plus company/role
context). Body includes the description if present.

### 6. Web/UI

API client (`apps/web/src/api/jobApplications.ts`): Add follow-up CRUD methods:

```typescript
listFollowUps(id: string): Promise<ApiJobApplicationFollowUp[]>
createFollowUp(id: string, input): Promise<ApiJobApplicationFollowUp>
updateFollowUp(id: string, followUpId: string, input): Promise<ApiJobApplicationFollowUp>
deleteFollowUp(id: string, followUpId: string): Promise<void>
```

Remove `nextFollowUpAt` from `UpdateJobApplicationInput`.

API types (`apps/web/src/api/types.ts`): Add `ApiJobApplicationFollowUp` interface. Remove
`nextFollowUpAt` from `ApiJobApplicationTracking`. Add `followUps` to `ApiJobApplicationDetail`.

UI types (`apps/web/src/types.ts`): Add `FollowUp` interface. Remove `nextFollowUpAt` and
`followUpNotes` from `JobApplication`. Add `followUps?: FollowUp[]`.

Mappers (`apps/web/src/api/mappers.ts`):

- `mapApiJobApplicationToUi` — map `followUps` array.
- `mapTimeline` — generate timeline milestones from the `followUps` array (one per follow-up,
  sorted by `scheduledAt`).
- `mapUpcomingInterviews` — read from `followUps` array, filter to `reminderSentAt === null`,
  sort by `scheduledAt`, take next 5. Each entry uses follow-up `title` as the role label.

AppDetail (`apps/web/src/pages/AppDetail.tsx`):

- Replace the single "+ Add follow-up" form with a follow-ups list showing all follow-ups (upcoming
  ones with date/title/description, sent ones with a "reminder sent" badge).
- Add follow-up form gains `title` and `description` fields alongside the existing datetime field.
- Each follow-up row has edit and delete actions.
- Remove `handleSaveFollowUp` / `handleClearFollowUp` (which patched `nextFollowUpAt`), replace
  with `handleCreateFollowUp` / `handleUpdateFollowUp` / `handleDeleteFollowUp` calling the new API
  methods.
- Remove `followUpNotes` from metadata handling (follow-up descriptions are now first-class
  fields).

Dashboard (`apps/web/src/pages/Dashboard.tsx`): "Upcoming follow-ups" panel reads from the new
`followUps` on each detail (already mapped via `mapUpcomingInterviews`). Multiple follow-ups per
app now appear as separate entries.

## Scope

This spec covers the full replacement of the single-follow-up system with multi-follow-up support
across the database, domain, infrastructure, API, worker, and web layers. It is a single
implementation plan.

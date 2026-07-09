# Multiple Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `next_follow_up_at` column on `job_applications` with a dedicated `job_application_follow_ups` table that supports multiple follow-ups per application, each with its own title, description, scheduled date, and independent email reminder.

**Architecture:** New one-to-many table following the existing `job_application_contacts` sub-resource pattern. Each follow-up row carries its own reminder scheduling state. The notifications worker keys reminders by `followUpId` instead of `jobApplicationId`. The web UI gains full CRUD for follow-ups.

**Tech Stack:** TypeScript 5.7 (ESM, strict), Knex 3.1 migrations, PostgreSQL, BullMQ, Express 4.21, Zod 3.24, React 19, Vitest 2.1.

## Global Constraints

- Node.js 22, pnpm 9.15.0, Turborepo 2.3
- ESLint 10, typescript-eslint 8.61, Prettier 3.8
- Internal relative TypeScript imports include the runtime `.js` extension
- Intentionally unused variables/arguments prefixed with `_`
- Backend source organized by bounded context; no broad generic folders
- Backend and package source files use kebab-case; React components/pages use PascalCase
- Tests colocated with behavior; `*.test.ts` / `*.test.tsx`
- Workspace packages use `@link2cv/*` scope
- Validate external inputs with Zod schemas before persisting
- Run quality gates before considering work ready: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- User has requested: do NOT commit changes; work on the master branch

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `packages/infrastructure/src/persistence/postgres-migrations/20260708020000_add_job_application_follow_ups.cjs` | Knex migration: create table, migrate existing data, drop old columns |
| `packages/domain/src/job-applications/job-application-follow-up.ts` | Domain entity, create/update input types for follow-ups |

### Modified files

| File | Responsibility |
|------|----------------|
| `packages/domain/src/job-applications/job-application-follow-up.ts` | (new) entity + input types |
| `packages/domain/src/job-applications/job-application.ts` | Remove follow-up fields from tracking; remove from create/update inputs |
| `packages/domain/src/job-applications/job-application-repository.ts` | Add follow-up CRUD methods to repository interface |
| `packages/domain/src/notifications/follow-up-reminder.ts` | Key reminders by followUpId; add title/description to candidate |
| `packages/domain/src/index.ts` | Export new follow-up domain file |
| `packages/contracts/src/job-applications/job-application.schema.ts` | Add follow-up schemas; remove nextFollowUpAt from create/update schemas |
| `packages/contracts/src/job-applications/job-application.schema.test.ts` | Remove nextFollowUpAt test; add follow-up schema tests |
| `packages/infrastructure/src/persistence/mappers.ts` | Add toJobApplicationFollowUp; remove old reminder columns from toJobApplication |
| `packages/infrastructure/src/persistence/job-applications/knex-job-application.repository.ts` | Add follow-up CRUD; remove old column writes |
| `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.ts` | Add follow-up CRUD map; remove nextFollowUpAt from tracking |
| `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts` | Add follow-up CRUD test; update delete test |
| `packages/infrastructure/src/job-applications/publishing-job-application.repository.ts` | Wrap follow-up CRUD methods with change publishing |
| `packages/infrastructure/src/notifications/follow-up-reminder.repository.ts` | Rewrite queries to target job_application_follow_ups |
| `packages/infrastructure/src/queue/notifications/bullmq-follow-up-reminder.queue.ts` | Job ID keyed by followUpId; payload includes followUpId |
| `packages/infrastructure/src/notifications/smtp-notification-email.sender.ts` | sendFollowUpReminder gains title + description |
| `packages/infrastructure/src/index.ts` | (no new exports needed — follow-up reminder repo already exported) |
| `apps/api/src/job-applications/job-applications.routes.ts` | Add follow-up CRUD routes; rewrite scheduleFollowUpReminder; remove nextFollowUpAt from POST/PATCH; add followUps to detail |
| `apps/api/src/job-applications/job-applications.routes.test.ts` | Update createJobApplicationRepository mock; update createTracking; add detail follow-ups test |
| `apps/notifications-worker/src/app.ts` | Use followUpId; include title/description in email + notification |
| `apps/web/src/api/types.ts` | Add ApiJobApplicationFollowUp; add followUps to detail; remove nextFollowUpAt from tracking |
| `apps/web/src/api/jobApplications.ts` | Add follow-up CRUD methods; remove nextFollowUpAt from UpdateJobApplicationInput |
| `apps/web/src/types.ts` | Add FollowUp interface; remove nextFollowUpAt + followUpNotes from JobApplication; add followUps |
| `apps/web/src/api/mappers.ts` | Map followUps; rewrite mapTimeline + mapUpcomingInterviews from followUps |
| `apps/web/src/api/mappers.test.ts` | Update createApplicationDetail; update assertions |
| `apps/web/src/pages/AppDetail.tsx` | Replace single follow-up form with follow-ups list + CRUD UI |

---

## Task 1: Domain Model — Follow-Up Entity and Reminder Interface Changes

**Files:**
- Create: `packages/domain/src/job-applications/job-application-follow-up.ts`
- Modify: `packages/domain/src/job-applications/job-application.ts`
- Modify: `packages/domain/src/job-applications/job-application-repository.ts`
- Modify: `packages/domain/src/notifications/follow-up-reminder.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/job-applications/job-application.test.ts` (verify compilation)

**Interfaces:**
- Produces: `JobApplicationFollowUp`, `CreateJobApplicationFollowUpInput`, `UpdateJobApplicationFollowUpInput` in `@link2cv/domain`
- Produces: Updated `FollowUpReminderQueuePayload` with `followUpId: string`
- Produces: Updated `FollowUpReminderRepository` with methods keyed by `followUpId`
- Produces: Updated `FollowUpReminderCandidate` with `followUpId`, `title`, `description`, `scheduledAt`
- Produces: Updated `ScheduleFollowUpReminderInput` with `followUpId`
- Produces: Updated `NotificationEmailSender.sendFollowUpReminder` with `title` and `description`
- Produces: Updated `JobApplicationRepository` with `createFollowUp`, `findFollowUpById`, `listFollowUps`, `updateFollowUp`, `deleteFollowUp`
- Produces: `JobApplicationTrackingFields` without `nextFollowUpAt`, `followUpReminderJobId`, `followUpReminderScheduledFor`, `followUpReminderSentAt`

- [ ] **Step 1: Create the follow-up domain entity file**

Create `packages/domain/src/job-applications/job-application-follow-up.ts`:

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

- [ ] **Step 2: Remove follow-up fields from job-application.ts tracking**

In `packages/domain/src/job-applications/job-application.ts`, remove these four fields from `JobApplicationTrackingFields`:

```typescript
  nextFollowUpAt?: Date;
  followUpReminderJobId?: string;
  followUpReminderScheduledFor?: Date;
  followUpReminderSentAt?: Date;
```

Remove `"nextFollowUpAt"` from the `Pick` in `CreateJobApplicationInput` (lines 41-52). The updated `CreateJobApplicationInput`:

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
    | "lastResponseAt"
    | "metadata"
  >
> {
  profileId: string;
  sourceUrl?: string;
  jobUrl?: string;
}
```

Remove `nextFollowUpAt` from `UpdateJobApplicationTrackingInput`:

```typescript
export interface UpdateJobApplicationTrackingInput {
  companyName?: string;
  roleTitle?: string;
  roleType?: string;
  jobUrl?: string;
  dateApplied?: string;
  applicationStatus?: ApplicationStatus;
  priority?: ApplicationPriority;
  tags?: string[];
  lastResponseAt?: Date | null;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 3: Add follow-up CRUD to JobApplicationRepository interface**

In `packages/domain/src/job-applications/job-application-repository.ts`, add the new types to the import from `./job-application.js`:

```typescript
import type {
  ApplicationPriority,
  ApplicationStatus,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "./job-application.js";
```

Add these methods to the `JobApplicationRepository` interface (after `listContacts` / before `attachGeneratedDocument`, matching the contacts pattern position):

```typescript
  createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp>;
  findFollowUpById(id: string): Promise<JobApplicationFollowUp | null>;
  listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]>;
  updateFollowUp(id: string, input: UpdateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp>;
  deleteFollowUp(id: string): Promise<void>;
```

- [ ] **Step 4: Rewrite the follow-up reminder domain types**

Replace the entire contents of `packages/domain/src/notifications/follow-up-reminder.ts` with:

```typescript
export const followUpReminderLeadTimeMs = 10 * 60 * 1000;

export interface FollowUpReminderQueuePayload {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: string;
  scheduledFor: string;
}

export interface ScheduleFollowUpReminderInput {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: Date;
  scheduledFor: Date;
}

export interface ScheduledFollowUpReminder {
  jobId: string;
}

export interface FollowUpReminderQueue {
  enqueue(input: ScheduleFollowUpReminderInput): Promise<ScheduledFollowUpReminder>;
  remove(jobId: string): Promise<void>;
  close(): Promise<void>;
}

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

export interface UpdateFollowUpReminderScheduleInput {
  jobId: string;
  scheduledFor: Date;
}

export interface FollowUpReminderRepository {
  setSchedule(followUpId: string, input: UpdateFollowUpReminderScheduleInput): Promise<void>;
  clearSchedule(followUpId: string): Promise<void>;
  findValidReminder(input: FollowUpReminderQueuePayload): Promise<FollowUpReminderCandidate | null>;
  listPendingForRecovery(now: Date): Promise<FollowUpReminderCandidate[]>;
  markSent(input: FollowUpReminderQueuePayload, sentAt: Date): Promise<boolean>;
}

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

- [ ] **Step 5: Export the new domain file**

In `packages/domain/src/index.ts`, add after line 5 (`export * from "./job-applications/job-application-repository.js";`):

```typescript
export * from "./job-applications/job-application-follow-up.js";
```

- [ ] **Step 6: Run typecheck to verify domain compiles**

Run: `pnpm typecheck`
Expected: Errors in infrastructure/api packages that reference removed fields — these are expected and will be fixed in later tasks. The `packages/domain` package itself should compile. Verify there are no errors originating from files under `packages/domain/src/`.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/job-applications/job-application-follow-up.ts packages/domain/src/job-applications/job-application.ts packages/domain/src/job-applications/job-application-repository.ts packages/domain/src/notifications/follow-up-reminder.ts packages/domain/src/index.ts
git commit -m "feat(domain): add JobApplicationFollowUp entity and key reminders by followUpId"
```

---

## Task 2: Contracts — Follow-Up Schemas and Remove nextFollowUpAt

**Files:**
- Modify: `packages/contracts/src/job-applications/job-application.schema.ts`
- Modify: `packages/contracts/src/job-applications/job-application.schema.test.ts`
- Test: `packages/contracts/src/job-applications/job-application.schema.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `createJobApplicationFollowUpSchema`, `updateJobApplicationFollowUpSchema`, `CreateJobApplicationFollowUpDto`, `UpdateJobApplicationFollowUpDto` in `@link2cv/contracts`
- Produces: `createJobApplicationSchema` and `updateJobApplicationSchema` without `nextFollowUpAt`

- [ ] **Step 1: Write the failing test for follow-up schemas**

Add this test to `packages/contracts/src/job-applications/job-application.schema.test.ts` (before the closing `});` of the describe block):

```typescript
  it("accepts follow-up payloads with title, description, and scheduled date", () => {
    const created = createJobApplicationFollowUpSchema.parse({
      title: "Send thank-you email",
      description: "Follow up after the phone screen.",
      scheduledAt: "2026-07-15T09:00:00.000Z",
    });
    const updated = updateJobApplicationFollowUpSchema.parse({
      title: "Check on application status",
      description: null,
      scheduledAt: "2026-07-20T14:00:00.000Z",
    });

    expect(created.title).toBe("Send thank-you email");
    expect(created.scheduledAt).toEqual(new Date("2026-07-15T09:00:00.000Z"));
    expect(updated.description).toBeNull();
    expect(updated.scheduledAt).toEqual(new Date("2026-07-20T14:00:00.000Z"));
  });
```

Add `createJobApplicationFollowUpSchema` and `updateJobApplicationFollowUpSchema` to the import at the top of the file:

```typescript
import {
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationFollowUpSchema,
  createJobApplicationSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationFollowUpSchema,
  updateJobApplicationSchema,
  scrapeBundleSchema,
} from "./job-application.schema.js";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @link2cv/contracts test -- --run packages/contracts/src/job-applications/job-application.schema.test.ts`
Expected: FAIL with "createJobApplicationFollowUpSchema is not defined" or import error.

- [ ] **Step 3: Add follow-up schemas and remove nextFollowUpAt**

In `packages/contracts/src/job-applications/job-application.schema.ts`:

Remove `nextFollowUpAt` from `createJobApplicationSchema` (line 36):

```typescript
export const createJobApplicationSchema = z
  .object({
    profileId: z.string().min(1),
    sourceUrl: linkedInJobUrlSchema.optional(),
    companyName: z.string().min(1).optional(),
    roleTitle: z.string().min(1).optional(),
    roleType: z.string().min(1).optional(),
    jobUrl: z.string().url().optional(),
    dateApplied: z.string().min(1).optional(),
    applicationStatus: applicationStatusSchema.default("applied"),
    priority: applicationPrioritySchema.default("medium"),
    tags: tagsSchema,
    lastResponseAt: z.coerce.date().optional(),
    metadata: metadataSchema,
  })
```

Remove `nextFollowUpAt` from `updateJobApplicationSchema` (line 110):

```typescript
export const updateJobApplicationSchema = z.object({
  companyName: z.string().min(1).optional(),
  roleTitle: z.string().min(1).optional(),
  roleType: z.string().min(1).optional(),
  jobUrl: z.string().url().optional(),
  dateApplied: z.string().min(1).optional(),
  applicationStatus: applicationStatusSchema.optional(),
  priority: applicationPrioritySchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
  lastResponseAt: z.coerce.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

Add the follow-up schemas after `updateJobApplicationSchema`:

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

Add the DTO types after `UpdateJobApplicationDto`:

```typescript
export type CreateJobApplicationFollowUpDto = z.infer<typeof createJobApplicationFollowUpSchema>;
export type UpdateJobApplicationFollowUpDto = z.infer<typeof updateJobApplicationFollowUpSchema>;
```

- [ ] **Step 4: Update the existing nextFollowUpAt test**

In `packages/contracts/src/job-applications/job-application.schema.test.ts`, update the "accepts tracker updates" test to remove the `nextFollowUpAt` assertion:

```typescript
  it("accepts tracker updates", () => {
    const result = updateJobApplicationSchema.parse({
      applicationStatus: "interview",
      priority: "high",
      tags: ["Remote", "Dream Job"],
    });

    expect(result.applicationStatus).toBe("interview");
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @link2cv/contracts test -- --run packages/contracts/src/job-applications/job-application.schema.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/job-applications/job-application.schema.ts packages/contracts/src/job-applications/job-application.schema.test.ts
git commit -m "feat(contracts): add follow-up schemas and remove nextFollowUpAt"
```

---

## Task 3: Database Migration — Create follow_ups Table and Drop Old Columns

**Files:**
- Create: `packages/infrastructure/src/persistence/postgres-migrations/20260708020000_add_job_application_follow_ups.cjs`

**Interfaces:**
- Produces: `job_application_follow_ups` table with columns: `id`, `job_application_id`, `profile_id`, `title`, `description`, `scheduled_at`, `reminder_job_id`, `reminder_scheduled_for`, `reminder_sent_at`, `created_at`, `updated_at`

- [ ] **Step 1: Create the migration file**

Create `packages/infrastructure/src/persistence/postgres-migrations/20260708020000_add_job_application_follow_ups.cjs`:

```javascript
exports.up = async function up(knex) {
  await knex.schema.createTable("job_application_follow_ups", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.timestamp("scheduled_at", { useTz: true }).notNullable();
    table.text("reminder_job_id");
    table.timestamp("reminder_scheduled_for", { useTz: true });
    table.timestamp("reminder_sent_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "create index idx_follow_ups_job_app on job_application_follow_ups(job_application_id)",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_reminder_recovery on job_application_follow_ups(reminder_scheduled_for, reminder_sent_at) where reminder_sent_at is null",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_profile_upcoming on job_application_follow_ups(profile_id, scheduled_at) where reminder_sent_at is null",
  );

  const appsWithFollowUp = await knex("job_applications")
    .whereNotNull("next_follow_up_at")
    .select(
      "id",
      "profile_id",
      "next_follow_up_at",
      "follow_up_reminder_job_id",
      "follow_up_reminder_scheduled_for",
      "follow_up_reminder_sent_at",
      "created_at",
    );

  for (const app of appsWithFollowUp) {
    await knex("job_application_follow_ups").insert({
      id: `${app.id}:migrated-follow-up`,
      job_application_id: app.id,
      profile_id: app.profile_id,
      title: "Follow-up",
      description: null,
      scheduled_at: app.next_follow_up_at,
      reminder_job_id: app.follow_up_reminder_job_id,
      reminder_scheduled_for: app.follow_up_reminder_scheduled_for,
      reminder_sent_at: app.follow_up_reminder_sent_at,
      created_at: app.created_at,
      updated_at: knex.fn.now(),
    });
  }

  await knex.schema.raw("drop index if exists idx_job_applications_follow_up_reminder");
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("next_follow_up_at");
    table.dropColumn("follow_up_reminder_job_id");
    table.dropColumn("follow_up_reminder_scheduled_for");
    table.dropColumn("follow_up_reminder_sent_at");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.timestamp("next_follow_up_at", { useTz: true });
    table.text("follow_up_reminder_job_id");
    table.timestamp("follow_up_reminder_scheduled_for", { useTz: true });
    table.timestamp("follow_up_reminder_sent_at", { useTz: true });
  });
  await knex.schema.raw(
    "create index idx_job_applications_follow_up_reminder on job_applications(follow_up_reminder_scheduled_for, follow_up_reminder_sent_at)",
  );

  const followUps = await knex("job_application_follow_ups")
    .whereNull("reminder_sent_at")
    .select("*");

  for (const followUp of followUps) {
    await knex("job_applications")
      .where({ id: followUp.job_application_id })
      .update({
        next_follow_up_at: followUp.scheduled_at,
        follow_up_reminder_job_id: followUp.reminder_job_id,
        follow_up_reminder_scheduled_for: followUp.reminder_scheduled_for,
      });
  }

  await knex.schema.dropTableIfExists("job_application_follow_ups");
};
```

- [ ] **Step 2: Verify the migration file is syntactically valid**

Run: `node -c packages/infrastructure/src/persistence/postgres-migrations/20260708020000_add_job_application_follow_ups.cjs`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
git add packages/infrastructure/src/persistence/postgres-migrations/20260708020000_add_job_application_follow_ups.cjs
git commit -m "feat(infrastructure): add migration for job_application_follow_ups table"
```

---

## Task 4: Infrastructure — Mappers, Knex Repository, In-Memory Repository

**Files:**
- Modify: `packages/infrastructure/src/persistence/mappers.ts`
- Modify: `packages/infrastructure/src/persistence/job-applications/knex-job-application.repository.ts`
- Modify: `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.ts`
- Modify: `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts`
- Modify: `packages/infrastructure/src/job-applications/publishing-job-application.repository.ts`
- Test: `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts`

**Interfaces:**
- Consumes: `JobApplicationFollowUp`, `CreateJobApplicationFollowUpInput`, `UpdateJobApplicationFollowUpInput` from `@link2cv/domain`
- Produces: `toJobApplicationFollowUp` mapper function
- Produces: `KnexJobApplicationRepository` and `InMemoryJobApplicationRepository` with follow-up CRUD methods
- Produces: `PublishingJobApplicationRepository` wrapping follow-up CRUD with change publishing

- [ ] **Step 1: Write the failing test for in-memory follow-up CRUD**

In `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts`, add this test before the closing `});` of the describe block:

```typescript
  it("manages follow-ups for a job application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const followUp = await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: "profile-1",
      title: "Send thank-you email",
      description: "Follow up after the phone screen.",
      scheduledAt: new Date("2026-07-15T09:00:00.000Z"),
    });
    const updated = await repository.updateFollowUp(followUp.id, {
      title: "Check on application status",
      description: null,
    });

    expect(updated.title).toBe("Check on application status");
    expect(updated.description).toBeUndefined();
    expect(await repository.listFollowUps(job.id)).toEqual([updated]);

    await repository.deleteFollowUp(followUp.id);

    expect(await repository.listFollowUps(job.id)).toEqual([]);
  });
```

Also update the "deletes a job application and all related records" test — add a follow-up and verify it's cleared. Add after `await repository.createContact({...})`:

```typescript
    await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: "profile-1",
      title: "Follow up next week",
      scheduledAt: new Date("2026-07-15T09:00:00.000Z"),
    });
```

And add after `expect(await repository.listContacts(job.id)).toEqual([]);`:

```typescript
    expect(await repository.listFollowUps(job.id)).toEqual([]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @link2cv/infrastructure test -- --run packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts`
Expected: FAIL — `repository.createFollowUp is not a function`.

- [ ] **Step 3: Add toJobApplicationFollowUp mapper**

In `packages/infrastructure/src/persistence/mappers.ts`, add `JobApplicationFollowUp` to the import from `@link2cv/domain`:

```typescript
import type {
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateVariableAliases,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationStatus,
  Notification,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UserProfile,
} from "@link2cv/domain";
```

Remove the four follow-up fields from `toJobApplication` (lines 41-45):

```typescript
    tracking: {
      companyName: nullableString(row.company_name),
      roleTitle: nullableString(row.role_title),
      roleType: nullableString(row.role_type),
      jobUrl: nullableString(row.job_url),
      dateApplied: nullableString(row.date_applied),
      applicationStatus: (nullableString(row.application_status) ??
        "applied") as JobApplication["tracking"]["applicationStatus"],
      priority: (nullableString(row.priority) ??
        "medium") as JobApplication["tracking"]["priority"],
      tags: stringArray(row.tags),
      lastResponseAt: nullableDate(row.last_response_at),
      metadata: record(row.metadata),
    },
```

Add the `toJobApplicationFollowUp` mapper after `toJobApplicationContact`:

```typescript
export function toJobApplicationFollowUp(row: Record<string, unknown>): JobApplicationFollowUp {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    profileId: String(row.profile_id),
    title: String(row.title),
    description: nullableString(row.description),
    scheduledAt: new Date(String(row.scheduled_at)),
    reminderJobId: nullableString(row.reminder_job_id),
    reminderScheduledFor: nullableDate(row.reminder_scheduled_for),
    reminderSentAt: nullableDate(row.reminder_sent_at),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}
```

- [ ] **Step 4: Add follow-up CRUD to KnexJobApplicationRepository**

In `packages/infrastructure/src/persistence/job-applications/knex-job-application.repository.ts`:

Add to the type imports from `@link2cv/domain`:

```typescript
import type {
  AttachGeneratedDocumentInput,
  ClaimNextScrapeJobInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  DocumentContent,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";
```

Add `toJobApplicationFollowUp` to the mapper import:

```typescript
import {
  toGeneratedDocument,
  toJobApplication,
  toJobApplicationContact,
  toJobApplicationEvent,
  toJobApplicationFollowUp,
} from "../mappers.js";
```

In `create`, remove `next_follow_up_at: input.nextFollowUpAt ?? null,` (line 47).

In `updateTracking`, remove `if ("nextFollowUpAt" in input) update.next_follow_up_at = input.nextFollowUpAt ?? null;` (line 294).

In `deleteById`, add follow-ups cleanup inside the transaction:

```typescript
  async deleteById(id: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction("generated_documents").where({ job_application_id: id }).delete();
      await transaction("job_application_contacts").where({ job_application_id: id }).delete();
      await transaction("job_application_follow_ups").where({ job_application_id: id }).delete();
      await transaction("job_application_events").where({ job_application_id: id }).delete();
      await transaction("job_applications").where({ id }).delete();
    });
  }
```

Add follow-up CRUD methods after `deleteContact` (before `attachGeneratedDocument`):

```typescript
  async createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp> {
    const id = randomUUID();
    const [row] = await this.db("job_application_follow_ups")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        profile_id: input.profileId,
        title: input.title,
        description: input.description ?? null,
        scheduled_at: input.scheduledAt,
      })
      .returning("*");

    return toJobApplicationFollowUp(row);
  }

  async findFollowUpById(id: string): Promise<JobApplicationFollowUp | null> {
    const row = await this.db("job_application_follow_ups").where({ id }).first();
    return row ? toJobApplicationFollowUp(row) : null;
  }

  async listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]> {
    const rows = await this.db("job_application_follow_ups")
      .where({ job_application_id: jobApplicationId })
      .orderBy("scheduled_at", "asc");

    return rows.map(toJobApplicationFollowUp);
  }

  async updateFollowUp(
    id: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if ("title" in input) update.title = input.title;
    if ("description" in input) update.description = input.description ?? null;
    if ("scheduledAt" in input) update.scheduled_at = input.scheduledAt;

    const [row] = await this.db("job_application_follow_ups")
      .where({ id })
      .update(update)
      .returning("*");

    if (!row) {
      throw new Error(`Job application follow-up ${id} was not found`);
    }

    return toJobApplicationFollowUp(row);
  }

  async deleteFollowUp(id: string): Promise<void> {
    await this.db("job_application_follow_ups").where({ id }).delete();
  }
```

- [ ] **Step 5: Add follow-up CRUD to InMemoryJobApplicationRepository**

In `packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.ts`:

Add `CreateJobApplicationFollowUpInput`, `JobApplicationFollowUp`, `UpdateJobApplicationFollowUpInput` to the type imports:

```typescript
import type {
  AttachGeneratedDocumentInput,
  ClaimNextScrapeJobInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  DocumentContent,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";
```

Add a follow-ups map to the class fields:

```typescript
  private readonly followUps = new Map<string, JobApplicationFollowUp[]>();
```

In `create`, remove `nextFollowUpAt: input.nextFollowUpAt,` (line 48).

In `deleteById`, add `this.followUps.delete(id);` alongside the other cleanup:

```typescript
  async deleteById(id: string): Promise<void> {
    this.jobApplications.delete(id);
    this.scrapeBundles.delete(id);
    this.matchAnalyses.delete(id);
    this.documentContents.delete(id);
    this.documents.delete(id);
    this.events.delete(id);
    this.contacts.delete(id);
    this.followUps.delete(id);
  }
```

In `updateTracking`, remove the `nextFollowUpAt` merge logic (lines 266-269):

```typescript
    const updated: JobApplication = {
      ...existing,
      tracking: {
        ...existing.tracking,
        ...input,
        lastResponseAt:
          input.lastResponseAt === undefined
            ? existing.tracking.lastResponseAt
            : (input.lastResponseAt ?? undefined),
      },
      updatedAt: new Date(),
    };
```

Add follow-up CRUD methods after `deleteContact` (before `attachGeneratedDocument`):

```typescript
  async createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp> {
    const followUp: JobApplicationFollowUp = {
      id: randomUUID(),
      jobApplicationId: input.jobApplicationId,
      profileId: input.profileId,
      title: input.title,
      description: input.description,
      scheduledAt: input.scheduledAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const current = this.followUps.get(input.jobApplicationId) ?? [];

    this.followUps.set(input.jobApplicationId, [...current, followUp]);
    return followUp;
  }

  async findFollowUpById(id: string): Promise<JobApplicationFollowUp | null> {
    return [...this.followUps.values()].flat().find((followUp) => followUp.id === id) ?? null;
  }

  async listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]> {
    return [...(this.followUps.get(jobApplicationId) ?? [])].sort(
      (left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    );
  }

  async updateFollowUp(
    id: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    const existing = await this.findFollowUpById(id);

    if (!existing) {
      throw new Error(`Job application follow-up ${id} was not found`);
    }

    const updated: JobApplicationFollowUp = {
      ...existing,
      title: input.title ?? existing.title,
      description:
        input.description === undefined ? existing.description : (input.description ?? undefined),
      scheduledAt: input.scheduledAt ?? existing.scheduledAt,
      updatedAt: new Date(),
    };

    this.followUps.set(
      existing.jobApplicationId,
      (this.followUps.get(existing.jobApplicationId) ?? []).map((followUp) =>
        followUp.id === id ? updated : followUp,
      ),
    );
    return updated;
  }

  async deleteFollowUp(id: string): Promise<void> {
    const existing = await this.findFollowUpById(id);

    if (!existing) {
      return;
    }

    this.followUps.set(
      existing.jobApplicationId,
      (this.followUps.get(existing.jobApplicationId) ?? []).filter((followUp) => followUp.id !== id),
    );
  }
```

- [ ] **Step 6: Add follow-up CRUD to PublishingJobApplicationRepository**

In `packages/infrastructure/src/job-applications/publishing-job-application.repository.ts`, add the new types to the import:

```typescript
import type {
  AttachGeneratedDocumentInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  CreateJobApplicationInput,
  DocumentContent,
  JobApplicationChangePublisher,
  JobApplicationRepository,
  JobApplicationStatus,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";
```

Add follow-up CRUD methods after `deleteContact` (before `attachGeneratedDocument`):

```typescript
  async createFollowUp(input: CreateJobApplicationFollowUpInput) {
    const followUp = await this.repository.createFollowUp(input);
    await this.publishForApplication(input.jobApplicationId);
    return followUp;
  }

  findFollowUpById(id: string) {
    return this.repository.findFollowUpById(id);
  }

  listFollowUps(jobApplicationId: string) {
    return this.repository.listFollowUps(jobApplicationId);
  }

  async updateFollowUp(id: string, input: UpdateJobApplicationFollowUpInput) {
    const followUp = await this.repository.updateFollowUp(id, input);
    await this.publishForApplication(followUp.jobApplicationId);
    return followUp;
  }

  async deleteFollowUp(id: string) {
    const followUp = await this.repository.findFollowUpById(id);
    await this.repository.deleteFollowUp(id);

    if (followUp) {
      await this.publishForApplication(followUp.jobApplicationId);
    }
  }
```

- [ ] **Step 7: Run the in-memory repository tests to verify they pass**

Run: `pnpm --filter @link2cv/infrastructure test -- --run packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts`
Expected: PASS — all tests green including the new follow-up CRUD test and the updated delete test.

- [ ] **Step 8: Commit**

```bash
git add packages/infrastructure/src/persistence/mappers.ts packages/infrastructure/src/persistence/job-applications/knex-job-application.repository.ts packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.ts packages/infrastructure/src/persistence/job-applications/in-memory-job-application.repository.test.ts packages/infrastructure/src/job-applications/publishing-job-application.repository.ts
git commit -m "feat(infrastructure): add follow-up CRUD to repositories and mappers"
```

---

## Task 5: Infrastructure — Follow-Up Reminder Repository, Queue, Email Sender

**Files:**
- Modify: `packages/infrastructure/src/notifications/follow-up-reminder.repository.ts`
- Modify: `packages/infrastructure/src/queue/notifications/bullmq-follow-up-reminder.queue.ts`
- Modify: `packages/infrastructure/src/notifications/smtp-notification-email.sender.ts`

**Interfaces:**
- Consumes: `FollowUpReminderRepository`, `FollowUpReminderQueuePayload`, `FollowUpReminderCandidate`, `ScheduleFollowUpReminderInput` from `@link2cv/domain`
- Produces: `PostgresFollowUpReminderRepository` querying `job_application_follow_ups` by `follow_up_id`
- Produces: `BullMqFollowUpReminderQueue` with job ID `follow-up:${followUpId}` and payload including `followUpId`
- Produces: `createSmtpNotificationEmailSender` with `sendFollowUpReminder` accepting `title` and `description`

- [ ] **Step 1: Verify typecheck catches the email sender signature change**

The email sender interface now requires `title` and `description` in `sendFollowUpReminder`. The typecheck in Step 6 will catch any mismatch. No separate unit test is needed for the SMTP sender — it is a thin wrapper around nodemailer and its behavior is verified by the type system and the worker integration.

- [ ] **Step 2: Rewrite the follow-up reminder repository**

Replace the entire contents of `packages/infrastructure/src/notifications/follow-up-reminder.repository.ts`:

```typescript
import type { Knex } from "knex";
import type {
  FollowUpReminderCandidate,
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  UpdateFollowUpReminderScheduleInput,
} from "@link2cv/domain";
import { followUpReminderLeadTimeMs } from "@link2cv/domain";
import { nullableDate, nullableString } from "../persistence/mappers.js";

export class PostgresFollowUpReminderRepository implements FollowUpReminderRepository {
  constructor(private readonly db: Knex) {}

  async setSchedule(
    followUpId: string,
    input: UpdateFollowUpReminderScheduleInput,
  ): Promise<void> {
    await this.db("job_application_follow_ups").where({ id: followUpId }).update({
      reminder_job_id: input.jobId,
      reminder_scheduled_for: input.scheduledFor,
      reminder_sent_at: null,
      updated_at: this.db.fn.now(),
    });
  }

  async clearSchedule(followUpId: string): Promise<void> {
    await this.db("job_application_follow_ups").where({ id: followUpId }).update({
      reminder_job_id: null,
      reminder_scheduled_for: null,
      reminder_sent_at: null,
      updated_at: this.db.fn.now(),
    });
  }

  async findValidReminder(
    input: FollowUpReminderQueuePayload,
  ): Promise<FollowUpReminderCandidate | null> {
    const row = await this.baseQuery()
      .where("job_application_follow_ups.id", input.followUpId)
      .where("job_application_follow_ups.job_application_id", input.jobApplicationId)
      .where("job_application_follow_ups.profile_id", input.profileId)
      .where("user_profiles.follow_up_reminders_enabled", true)
      .first();

    const candidate = row ? toFollowUpReminderCandidate(row) : null;

    if (!candidate || candidate.reminderSentAt) {
      return null;
    }

    if (
      candidate.scheduledAt.toISOString() !== new Date(input.followUpAt).toISOString() ||
      candidate.reminderScheduledFor?.toISOString() !== new Date(input.scheduledFor).toISOString()
    ) {
      return null;
    }

    return candidate;
  }

  async listPendingForRecovery(now: Date): Promise<FollowUpReminderCandidate[]> {
    const rows = await this.baseQuery()
      .whereNull("job_application_follow_ups.reminder_sent_at")
      .where("user_profiles.follow_up_reminders_enabled", true)
      .andWhere((builder) => {
        builder
          .whereNull("job_application_follow_ups.reminder_scheduled_for")
          .orWhere("job_application_follow_ups.reminder_scheduled_for", "<=", now);
      })
      .orderBy("job_application_follow_ups.scheduled_at", "asc");

    return rows.map(toFollowUpReminderCandidate);
  }

  async markSent(input: FollowUpReminderQueuePayload, sentAt: Date): Promise<boolean> {
    const updated = await this.db("job_application_follow_ups")
      .where({ id: input.followUpId })
      .whereNull("reminder_sent_at")
      .where("scheduled_at", new Date(input.followUpAt))
      .where("reminder_scheduled_for", new Date(input.scheduledFor))
      .update({
        reminder_sent_at: sentAt,
        updated_at: this.db.fn.now(),
      });

    return updated > 0;
  }

  private baseQuery() {
    return this.db("job_application_follow_ups")
      .join("user_profiles", "user_profiles.id", "job_application_follow_ups.profile_id")
      .join(
        "job_applications",
        "job_applications.id",
        "job_application_follow_ups.job_application_id",
      )
      .select(
        "job_application_follow_ups.id as follow_up_id",
        "job_application_follow_ups.job_application_id",
        "job_application_follow_ups.profile_id",
        "user_profiles.email as profile_email",
        "user_profiles.follow_up_reminders_enabled",
        "job_applications.company_name",
        "job_applications.role_title",
        "job_application_follow_ups.title",
        "job_application_follow_ups.description",
        "job_application_follow_ups.scheduled_at",
        "job_application_follow_ups.reminder_job_id",
        "job_application_follow_ups.reminder_scheduled_for",
        "job_application_follow_ups.reminder_sent_at",
      );
  }
}

export function getFollowUpReminderScheduledFor(followUpAt: Date): Date {
  return new Date(followUpAt.getTime() - followUpReminderLeadTimeMs);
}

function toFollowUpReminderCandidate(row: Record<string, unknown>): FollowUpReminderCandidate {
  return {
    followUpId: String(row.follow_up_id),
    jobApplicationId: String(row.job_application_id),
    profileId: String(row.profile_id),
    profileEmail: String(row.profile_email),
    companyName: nullableString(row.company_name),
    roleTitle: nullableString(row.role_title),
    title: String(row.title),
    description: nullableString(row.description),
    scheduledAt: new Date(String(row.scheduled_at)),
    reminderJobId: nullableString(row.reminder_job_id),
    reminderScheduledFor: nullableDate(row.reminder_scheduled_for),
    reminderSentAt: nullableDate(row.reminder_sent_at),
  };
}
```

- [ ] **Step 3: Update the BullMQ queue to key by followUpId**

In `packages/infrastructure/src/queue/notifications/bullmq-follow-up-reminder.queue.ts`, update the `enqueue` method to include `followUpId` in the payload and change the job ID:

```typescript
  async enqueue(input: ScheduleFollowUpReminderInput): Promise<ScheduledFollowUpReminder> {
    const scheduledFor = input.scheduledFor;
    const jobId = `follow-up:${input.followUpId}`;
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());

    await this.queue.add(
      "send",
      {
        followUpId: input.followUpId,
        jobApplicationId: input.jobApplicationId,
        profileId: input.profileId,
        followUpAt: input.followUpAt.toISOString(),
        scheduledFor: scheduledFor.toISOString(),
      },
      {
        ...this.options,
        delay,
        jobId,
      },
    );

    return { jobId };
  }
```

Remove the old `followUpReminderJobId` helper function at the bottom of the file.

- [ ] **Step 4: Update the email sender to include title and description**

In `packages/infrastructure/src/notifications/smtp-notification-email.sender.ts`, replace the `sendFollowUpReminder` method:

```typescript
  return {
    async sendFollowUpReminder({ email, companyName, roleTitle, followUpAt, title, description }) {
      const target = [companyName, roleTitle].filter(Boolean).join(" - ") || "your application";
      const formatted = followUpAt.toLocaleString();

      await transport.sendMail({
        from: config.from,
        to: email,
        subject: `Follow-up reminder: ${title}`,
        text: `Reminder: ${title} — follow up on ${target} at ${formatted}.${description ? `\n\n${description}` : ""}`,
        html: `<p>Reminder: <strong>${title}</strong> — follow up on <strong>${target}</strong> at ${formatted}.</p>${description ? `<p>${description}</p>` : ""}`,
      });
    },
  };
```

- [ ] **Step 5: Run typecheck to verify infrastructure compiles**

Run: `pnpm typecheck`
Expected: Remaining errors should only be in `apps/api` and `apps/web` and `apps/notifications-worker` — the `packages/infrastructure` package should compile cleanly now.

- [ ] **Step 6: Commit**

```bash
git add packages/infrastructure/src/notifications/follow-up-reminder.repository.ts packages/infrastructure/src/queue/notifications/bullmq-follow-up-reminder.queue.ts packages/infrastructure/src/notifications/smtp-notification-email.sender.ts
git commit -m "feat(infrastructure): key reminders by followUpId and include title/description in emails"
```

---

## Task 6: API Routes — Follow-Up CRUD and Detail Response

**Files:**
- Modify: `apps/api/src/job-applications/job-applications.routes.ts`
- Modify: `apps/api/src/job-applications/job-applications.routes.test.ts`
- Test: `apps/api/src/job-applications/job-applications.routes.test.ts`

**Interfaces:**
- Consumes: `createJobApplicationFollowUpSchema`, `updateJobApplicationFollowUpSchema` from `@link2cv/contracts`; `JobApplicationFollowUp`, `CreateJobApplicationFollowUpInput`, `UpdateJobApplicationFollowUpInput` from `@link2cv/domain`
- Produces: `POST /:id/follow-ups`, `GET /:id/follow-ups`, `PATCH /:id/follow-ups/:followUpId`, `DELETE /:id/follow-ups/:followUpId` routes
- Produces: `JobApplicationDetail` type with `followUps: JobApplicationFollowUp[]`
- Produces: `getJobApplicationDetail` including `followUps` in the response
- Produces: `scheduleFollowUpReminder` helper rewritten to accept a `followUp` object

- [ ] **Step 1: Write the failing test for detail including follow-ups**

In `apps/api/src/job-applications/job-applications.routes.test.ts`, update the "includes contacts and follow-up events in the detail response" test. First add `JobApplicationFollowUp` to the import:

```typescript
import type {
  DocumentContent,
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationQueue,
  JobApplicationRepository,
} from "@link2cv/domain";
```

Update the test at line 252 — remove `nextFollowUpAt` from the tracking overrides, add a follow-up to the mock, and verify it appears in the detail:

```typescript
  it("includes contacts, events, and follow-ups in the detail response", async () => {
    const job = createJobApplication({ id: "job-1" });
    const contact = createContact({ jobApplicationId: job.id });
    const event = createEvent({ jobApplicationId: job.id, title: "Follow-up scheduled" });
    const followUp = createFollowUp({ jobApplicationId: job.id });
    const jobApplications = createJobApplicationRepository({
      getDocumentContent: vi.fn(
        async () =>
          ({
            customizedSummary: {
              version: 1,
              blocks: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Editable summary" }],
                },
              ],
            },
            experienceEnhancements: [],
          }) satisfies DocumentContent,
      ),
      listContacts: vi.fn(async () => [contact]),
      listEvents: vi.fn(async () => [event]),
      listFollowUps: vi.fn(async () => [followUp]),
      listGeneratedDocuments: vi.fn(async () => []),
      getScrapeBundle: vi.fn(async () => ({
        job: {
          title: "Engineer",
          companyName: "Acme",
          description: "Build software",
          requirements: [],
          raw: {},
        },
        companyLinkedIn: {
          name: "Acme",
          logoFileId: "logos/acme.png",
          logoUrl: "https://media.licdn.com/acme.png",
          raw: {},
        },
```

Continue the test (keep the rest of the existing assertions) and add:

```typescript
    expect(detail.followUps).toEqual([followUp]);
```

Add a `createFollowUp` helper function at the bottom of the file (after `createContact`):

```typescript
function createFollowUp(
  overrides: Partial<JobApplicationFollowUp> = {},
): JobApplicationFollowUp {
  return {
    id: "follow-up-1",
    jobApplicationId: "job-1",
    profileId: "profile-1",
    title: "Send thank-you email",
    description: "Follow up after the phone screen.",
    scheduledAt: new Date("2026-07-15T09:00:00.000Z"),
    createdAt: new Date("2026-07-08T09:00:00.000Z"),
    updatedAt: new Date("2026-07-08T09:00:00.000Z"),
    ...overrides,
  };
}
```

Update `createTracking` to remove `nextFollowUpAt` (it's already not there — just verify it doesn't include it).

Update `createJobApplicationRepository` to add `listFollowUps`, `createFollowUp`, `findFollowUpById`, `updateFollowUp`, `deleteFollowUp` to the default mock:

```typescript
    listFollowUps: vi.fn(async () => []),
    createFollowUp: vi.fn(),
    findFollowUpById: vi.fn(),
    updateFollowUp: vi.fn(),
    deleteFollowUp: vi.fn(),
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @link2cv/api test -- --run apps/api/src/job-applications/job-applications.routes.test.ts`
Expected: FAIL — `listFollowUps` is not on the mock type, or `detail.followUps` is undefined.

- [ ] **Step 3: Update imports and types in the routes file**

In `apps/api/src/job-applications/job-applications.routes.ts`, add follow-up types to the domain import:

```typescript
import type {
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  GeneratedDocument,
  JobApplication,
  JobApplicationFollowUp,
  JobApplicationQueue,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
} from "@link2cv/domain";
```

Add follow-up schemas to the contracts import:

```typescript
import {
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationFollowUpSchema,
  createJobApplicationSchema,
  createJobApplicationFromScrapeSchema,
  failScrapeJobSchema,
  heartbeatScrapeJobSchema,
  listJobApplicationsQuerySchema,
  submitScrapeDataSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationFollowUpSchema,
  updateJobApplicationSchema,
  updateStatusSchema,
  updateDocumentContentSchema,
} from "@link2cv/contracts";
```

Update `JobApplicationDetail` type to include `followUps`:

```typescript
export type JobApplicationDetail = JobApplicationWithDocuments & {
  events: JobApplicationEvent[];
  contacts: JobApplicationContact[];
  followUps: JobApplicationFollowUp[];
  scrapeBundle: ScrapeBundle | null;
  matchAnalysis: MatchAnalysisResult | null;
  documentContent: DocumentContent | null;
};
```

- [ ] **Step 4: Add followUps to getJobApplicationDetail**

In `getJobApplicationDetail`, add `listFollowUps`:

```typescript
export async function getJobApplicationDetail(input: {
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
  jobApplication: JobApplication;
}): Promise<JobApplicationDetail> {
  const documents = await input.jobApplications.listGeneratedDocuments(input.jobApplication.id);
  const events = await input.jobApplications.listEvents(input.jobApplication.id);
  const contacts = await input.jobApplications.listContacts(input.jobApplication.id);
  const followUps = await input.jobApplications.listFollowUps(input.jobApplication.id);
  const scrapeBundle = await input.jobApplications.getScrapeBundle(input.jobApplication.id);
  const matchAnalysis = await input.jobApplications.getMatchAnalysis(input.jobApplication.id);
  const documentContent = await input.jobApplications.getDocumentContent(input.jobApplication.id);
  const companyLogoUrl = await getCompanyLogoUrl(
    input.jobApplications,
    input.storage,
    input.jobApplication.id,
  );

  return {
    ...input.jobApplication,
    documents,
    events,
    contacts,
    followUps,
    scrapeBundle: toPublicScrapeBundle(scrapeBundle),
    matchAnalysis,
    documentContent,
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
  };
}
```

- [ ] **Step 5: Rewrite scheduleFollowUpReminder helper**

Replace the `scheduleFollowUpReminder` function:

```typescript
async function scheduleFollowUpReminder(input: {
  followUp: JobApplicationFollowUp;
  followUpReminderQueue: FollowUpReminderQueue;
  followUpReminders: FollowUpReminderRepository;
}): Promise<void> {
  const scheduledFor = getFollowUpReminderScheduledFor(input.followUp.scheduledAt);
  const scheduled = await input.followUpReminderQueue.enqueue({
    followUpId: input.followUp.id,
    jobApplicationId: input.followUp.jobApplicationId,
    profileId: input.followUp.profileId,
    followUpAt: input.followUp.scheduledAt,
    scheduledFor,
  });

  await input.followUpReminders.setSchedule(input.followUp.id, {
    jobId: scheduled.jobId,
    scheduledFor,
  });
}
```

The routes file already imports `getFollowUpReminderScheduledFor` from `@link2cv/infrastructure` — keep that import as-is.

- [ ] **Step 6: Remove nextFollowUpAt scheduling from POST / and PATCH /:id**

In the `POST /` handler (around line 281), remove the follow-up reminder scheduling block:

```typescript
      const jobApplication = await dependencies.submitJobApplication.execute(request.body);
      response.status(201).json(jobApplication);
```

In the `PATCH /:id` handler (around line 454), remove the `if ("nextFollowUpAt" in request.body)` block entirely. Keep the status change event block.

- [ ] **Step 7: Add follow-up CRUD routes**

Add these routes after the contacts routes (after the `DELETE /:id/contacts/:contactId` route, before `PUT /:id/document-content`):

```typescript
  router.post(
    "/:id/follow-ups",
    validateBody(createJobApplicationFollowUpSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const followUp = await dependencies.jobApplications.createFollowUp({
          jobApplicationId: request.params.id,
          profileId: jobApplication.profileId,
          title: request.body.title,
          description: request.body.description,
          scheduledAt: request.body.scheduledAt,
        });

        await scheduleFollowUpReminder({
          followUp,
          followUpReminderQueue: dependencies.followUpReminderQueue,
          followUpReminders: dependencies.followUpReminders,
        });

        await dependencies.jobApplications.addEvent({
          jobApplicationId: request.params.id,
          type: "reminder",
          title: `Follow-up scheduled: ${followUp.title}`,
          occurredAt: followUp.scheduledAt,
        });

        response.status(201).json(followUp);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/follow-ups", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(await dependencies.jobApplications.listFollowUps(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/follow-ups/:followUpId",
    validateBody(updateJobApplicationFollowUpSchema),
    async (request, response, next) => {
      try {
        const existing = await dependencies.jobApplications.findFollowUpById(
          request.params.followUpId,
        );

        if (!existing || existing.jobApplicationId !== request.params.id) {
          response.status(404).json({ error: "Follow-up not found" });
          return;
        }

        const updated = await dependencies.jobApplications.updateFollowUp(
          request.params.followUpId,
          request.body,
        );

        if ("scheduledAt" in request.body && existing.reminderJobId) {
          await dependencies.followUpReminderQueue.remove(existing.reminderJobId);
        }

        if ("scheduledAt" in request.body) {
          await scheduleFollowUpReminder({
            followUp: updated,
            followUpReminderQueue: dependencies.followUpReminderQueue,
            followUpReminders: dependencies.followUpReminders,
          });

          await dependencies.jobApplications.addEvent({
            jobApplicationId: request.params.id,
            type: "reminder",
            title: `Follow-up rescheduled: ${updated.title}`,
            occurredAt: updated.scheduledAt,
          });
        }

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/follow-ups/:followUpId", async (request, response, next) => {
    try {
      const followUp = await dependencies.jobApplications.findFollowUpById(
        request.params.followUpId,
      );

      if (!followUp || followUp.jobApplicationId !== request.params.id) {
        response.status(404).json({ error: "Follow-up not found" });
        return;
      }

      if (followUp.reminderJobId) {
        await dependencies.followUpReminderQueue.remove(followUp.reminderJobId);
      }

      await dependencies.jobApplications.deleteFollowUp(request.params.followUpId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });
```

- [ ] **Step 8: Run the API tests to verify they pass**

Run: `pnpm --filter @link2cv/api test -- --run apps/api/src/job-applications/job-applications.routes.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/job-applications/job-applications.routes.ts apps/api/src/job-applications/job-applications.routes.test.ts
git commit -m "feat(api): add follow-up CRUD routes and include followUps in detail response"
```

---

## Task 7: Notifications Worker — Use followUpId and Include Title/Description

**Files:**
- Modify: `apps/notifications-worker/src/app.ts`

**Interfaces:**
- Consumes: `FollowUpReminderQueuePayload` with `followUpId` from `@link2cv/domain`; `FollowUpReminderCandidate` with `followUpId`, `title`, `description`, `scheduledAt` from `@link2cv/domain`
- Produces: Worker that creates notifications and sends emails using follow-up `title` and `description`

- [ ] **Step 1: Update the worker to use followUpId and include title/description**

In `apps/notifications-worker/src/app.ts`, update the worker handler:

```typescript
  const worker = new Worker<FollowUpReminderQueuePayload>(
    followUpReminderQueueName,
    async (job) => {
      const reminder = await reminders.findValidReminder(job.data);

      if (!reminder) {
        return;
      }

      const title = reminder.title;
      const body = createFollowUpBody(reminder.companyName, reminder.roleTitle, reminder.description);

      await notifications.create({
        profileId: reminder.profileId,
        jobApplicationId: reminder.jobApplicationId,
        type: "follow_up_reminder",
        title,
        body,
      });
      await emailSender.sendFollowUpReminder({
        email: reminder.profileEmail,
        companyName: reminder.companyName,
        roleTitle: reminder.roleTitle,
        followUpAt: reminder.scheduledAt,
        title: reminder.title,
        description: reminder.description,
      });
      await reminders.markSent(job.data, new Date());
    },
```

Update `recoverPendingReminders` to pass `followUpId`:

```typescript
async function recoverPendingReminders(
  reminders: PostgresFollowUpReminderRepository,
  reminderQueue: BullMqFollowUpReminderQueue,
) {
  const pending = await reminders.listPendingForRecovery(new Date());

  for (const reminder of pending) {
    const scheduledFor = getFollowUpReminderScheduledFor(reminder.scheduledAt);
    const scheduled = await reminderQueue.enqueue({
      followUpId: reminder.followUpId,
      jobApplicationId: reminder.jobApplicationId,
      profileId: reminder.profileId,
      followUpAt: reminder.scheduledAt,
      scheduledFor,
    });

    await reminders.setSchedule(reminder.followUpId, {
      jobId: scheduled.jobId,
      scheduledFor,
    });
  }
}
```

Update `createFollowUpBody` to include the description:

```typescript
function createFollowUpBody(companyName?: string, roleTitle?: string, description?: string) {
  const target = [companyName, roleTitle].filter(Boolean).join(" - ");
  const context = target ? `It is time to follow up on ${target}.` : "It is time to follow up.";
  return description ? `${context}\n\n${description}` : context;
}
```

- [ ] **Step 2: Run typecheck to verify the worker compiles**

Run: `pnpm typecheck`
Expected: No errors in `apps/notifications-worker`.

- [ ] **Step 3: Commit**

```bash
git add apps/notifications-worker/src/app.ts
git commit -m "feat(notifications-worker): use followUpId and include title/description in reminders"
```

---

## Task 8: Web — API Types, Client, UI Types, and Mappers

**Files:**
- Modify: `apps/web/src/api/types.ts`
- Modify: `apps/web/src/api/jobApplications.ts`
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api/mappers.ts`
- Modify: `apps/web/src/api/mappers.test.ts`
- Test: `apps/web/src/api/mappers.test.ts`

**Interfaces:**
- Consumes: none (web is the top of the stack)
- Produces: `ApiJobApplicationFollowUp` type, `FollowUp` UI type, follow-up CRUD API client methods
- Produces: `mapApiJobApplicationToUi` mapping `followUps`, `mapTimeline` and `mapUpcomingInterviews` reading from `followUps`

- [ ] **Step 1: Write the failing test for mapper changes**

In `apps/web/src/api/mappers.test.ts`, update `createApplicationDetail` to add `followUps` and remove `nextFollowUpAt` from tracking. Replace the `tracking` block and add `followUps`:

```typescript
    tracking: {
      applicationStatus: "interview",
      companyName: "Acme",
      dateApplied: "2026-06-01",
      metadata: {},
      priority: "high",
      roleTitle: "Frontend Engineer",
      tags: ["Remote"],
    },
    followUps: [
      {
        id: "follow-up-1",
        jobApplicationId: "job-1",
        profileId: "profile-1",
        title: "Send thank-you email",
        description: "Ask about the product roadmap.",
        scheduledAt: "2026-06-03T13:30:00.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
```

Update the "maps job application detail" test assertions:
- Change `expect(mapped.timeline?.map((item) => item.title)).toEqual(["Follow-up scheduled"]);` to:
```typescript
    expect(mapped.timeline?.map((item) => item.title)).toEqual(["Send thank-you email"]);
```
- Remove `expect(mapped.followUpNotes).toBe("Ask about the product roadmap.");`
- Add:
```typescript
    expect(mapped.followUps).toHaveLength(1);
    expect(mapped.followUps?.[0]?.title).toBe("Send thank-you email");
```

Update the "maps analytics and details into dashboard stats" test — `upcomingInterviews` should still have length 1 (the follow-up is upcoming since `reminderSentAt` is not set).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @link2cv/web test -- --run apps/web/src/api/mappers.test.ts`
Expected: FAIL — `followUps` not on the type, `nextFollowUpAt` still present, etc.

- [ ] **Step 3: Add ApiJobApplicationFollowUp and update detail type**

In `apps/web/src/api/types.ts`:

Remove `nextFollowUpAt?: string;` from `ApiJobApplicationTracking` (line 12).

Add `ApiJobApplicationFollowUp` interface after `ApiJobApplicationContact`:

```typescript
export interface ApiJobApplicationFollowUp {
  createdAt: string;
  description?: string;
  id: string;
  jobApplicationId: string;
  profileId: string;
  reminderJobId?: string;
  reminderScheduledFor?: string;
  reminderSentAt?: string;
  scheduledAt: string;
  title: string;
  updatedAt: string;
}
```

Add `followUps` to `ApiJobApplicationDetail`:

```typescript
export interface ApiJobApplicationDetail extends ApiJobApplication {
  contacts: ApiJobApplicationContact[];
  events: ApiJobApplicationEvent[];
  followUps: ApiJobApplicationFollowUp[];
  matchAnalysis: ApiMatchAnalysis | null;
  documentContent: ApiDocumentContent | null;
  scrapeBundle: ApiScrapeBundle | null;
}
```

- [ ] **Step 4: Add follow-up CRUD to the API client**

In `apps/web/src/api/jobApplications.ts`:

Remove `nextFollowUpAt?: string | null;` from `UpdateJobApplicationInput` (line 43).

Add `ApiJobApplicationFollowUp` to the imports:

```typescript
import type {
  ApiApplicationPriority,
  ApiApplicationStatus,
  ApiJobApplicationContact,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiJobApplicationFollowUp,
  ApiDocumentContent,
  ApiScrapeBundle,
} from "./types";
```

Add follow-up input types and CRUD methods to `jobApplicationsApi`:

```typescript
export interface CreateFollowUpInput {
  title: string;
  description?: string;
  scheduledAt: string;
}

export interface UpdateFollowUpInput {
  title?: string;
  description?: string | null;
  scheduledAt?: string;
}
```

Add to the `jobApplicationsApi` object (after `createContact`):

```typescript
  listFollowUps(id: string): Promise<ApiJobApplicationFollowUp[]> {
    return requestJson<ApiJobApplicationFollowUp[]>(`/job-applications/${id}/follow-ups`);
  },

  createFollowUp(id: string, input: CreateFollowUpInput): Promise<ApiJobApplicationFollowUp> {
    return requestJson<ApiJobApplicationFollowUp>(`/job-applications/${id}/follow-ups`, {
      method: "POST",
      body: input,
    });
  },

  updateFollowUp(
    id: string,
    followUpId: string,
    input: UpdateFollowUpInput,
  ): Promise<ApiJobApplicationFollowUp> {
    return requestJson<ApiJobApplicationFollowUp>(
      `/job-applications/${id}/follow-ups/${followUpId}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  },

  deleteFollowUp(id: string, followUpId: string): Promise<void> {
    return requestJson<void>(`/job-applications/${id}/follow-ups/${followUpId}`, {
      method: "DELETE",
    });
  },
```

- [ ] **Step 5: Add FollowUp UI type and update JobApplication**

In `apps/web/src/types.ts`:

Add `FollowUp` interface after `Contact`:

```typescript
export interface FollowUp {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  reminderSentAt?: string;
  createdAt: string;
}
```

In `JobApplication`, remove `nextFollowUpAt?: string;` and `followUpNotes?: string;`. Add `followUps?: FollowUp[];` (after `contacts?: Contact[];`):

```typescript
  contacts?: Contact[];
  followUps?: FollowUp[];
  generatedDocuments?: GeneratedApplicationDocument[];
```

- [ ] **Step 6: Update mappers to use followUps**

In `apps/web/src/api/mappers.ts`, add `ApiJobApplicationFollowUp` to the import:

```typescript
import type {
  ApiApplicationPriority,
  ApiApplicationStatus,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiJobApplicationEvent,
  ApiJobApplicationFollowUp,
  ApiMatchAnalysis,
  ApiProfile,
} from "./types";
```

Add `FollowUp` to the UI types import:

```typescript
import type {
  ApplicationStatus,
  DashboardStats,
  FollowUp,
  JobApplication,
  Priority,
  ProcessingLogItem,
  Profile,
  TimelineMilestone,
  UpcomingInterview,
} from "../types";
```

In `mapApiJobApplicationToUi`, replace `nextFollowUpAt` and `followUpNotes` with `followUps`:

```typescript
    sourceUrl: application.sourceUrl,
    followUps: detail?.followUps.map(mapFollowUp),
    matchScore: application.matchScore ?? detail?.matchAnalysis?.matchScore,
    metadata: application.tracking.metadata,
```

Remove the `followUpNotes: stringFromMetadata(...)` line.

Rewrite `mapTimeline` to read from `followUps`:

```typescript
function mapTimeline(
  application: ApiJobApplication | ApiJobApplicationDetail,
): TimelineMilestone[] {
  const detail = isJobApplicationDetail(application) ? application : undefined;
  if (!detail?.followUps || detail.followUps.length === 0) {
    return [];
  }

  return detail.followUps
    .map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      description: followUp.description ?? "",
      date: formatShortDate(followUp.scheduledAt),
      status: followUp.reminderSentAt ? "completed" : "upcoming",
      type: "Follow-up",
    }))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}
```

Rewrite `mapUpcomingInterviews` to read from `followUps`:

```typescript
function mapUpcomingInterviews(details: ApiJobApplicationDetail[]): UpcomingInterview[] {
  return details
    .flatMap((application) =>
      (application.followUps ?? [])
        .filter((followUp) => !followUp.reminderSentAt)
        .map((followUp) => ({
          followUp,
          application,
        })),
    )
    .map(({ followUp, application }) => ({
      scheduledAt: new Date(followUp.scheduledAt),
      followUp,
      application,
    }))
    .filter((item) => !Number.isNaN(item.scheduledAt.getTime()))
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    .slice(0, 5)
    .map(({ scheduledAt, followUp, application }) => ({
      month: scheduledAt.toLocaleString(undefined, { month: "short" }),
      day: scheduledAt.getDate(),
      time: scheduledAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
      company:
        application.tracking.companyName ??
        application.scrapeBundle?.job.companyName ??
        "Unknown company",
      role: followUp.title,
      meetType: "follow_up",
      meetLabel: "Follow-up",
    }));
}
```

Add the `mapFollowUp` helper:

```typescript
function mapFollowUp(followUp: ApiJobApplicationFollowUp): FollowUp {
  return {
    id: followUp.id,
    title: followUp.title,
    description: followUp.description,
    scheduledAt: followUp.scheduledAt,
    reminderSentAt: followUp.reminderSentAt,
    createdAt: followUp.createdAt,
  };
}
```

- [ ] **Step 7: Run the mapper tests to verify they pass**

Run: `pnpm --filter @link2cv/web test -- --run apps/web/src/api/mappers.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/api/jobApplications.ts apps/web/src/types.ts apps/web/src/api/mappers.ts apps/web/src/api/mappers.test.ts
git commit -m "feat(web): add follow-up types, API client, and mappers"
```

---

## Task 9: Web UI — AppDetail Follow-Ups List

**Files:**
- Modify: `apps/web/src/pages/AppDetail.tsx`

**Note:** The Dashboard "Upcoming follow-ups" panel requires no changes — it already reads from `stats.upcomingInterviews`, which is populated by `mapUpcomingInterviews` (updated in Task 8 to read from the `followUps` array). Multiple follow-ups per app will now appear as separate entries automatically.

**Interfaces:**
- Consumes: `FollowUp` type from `../types`, `jobApplicationsApi.createFollowUp` / `updateFollowUp` / `deleteFollowUp` from `../api/jobApplications`
- Produces: AppDetail Timeline tab with follow-ups list + add/edit/delete UI, Dashboard reading from mapped `followUps`

- [ ] **Step 1: Update AppDetail state and handlers**

In `apps/web/src/pages/AppDetail.tsx`, replace the follow-up state and handlers.

Remove these state declarations (lines 57-61):

```typescript
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  // ... keep isAddingContact, isSavingNotes ...
  const [followUpForm, setFollowUpForm] = useState({ nextFollowUpAt: "" });
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
```

Add new state:

```typescript
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    id: "",
    title: "",
    description: "",
    nextFollowUpAt: "",
  });
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
```

Replace `handleSaveFollowUp` and `handleClearFollowUp` with:

```typescript
  async function handleSaveFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !followUpForm.nextFollowUpAt || !followUpForm.title.trim()) return;
    try {
      setIsSavingFollowUp(true);
      setError(null);
      const payload = {
        title: followUpForm.title.trim(),
        description: followUpForm.description.trim() || undefined,
        scheduledAt: new Date(followUpForm.nextFollowUpAt).toISOString(),
      };
      if (editingFollowUpId) {
        await jobApplicationsApi.updateFollowUp(id, editingFollowUpId, payload);
      } else {
        await jobApplicationsApi.createFollowUp(id, payload);
      }
      setFollowUpForm({ id: "", title: "", description: "", nextFollowUpAt: "" });
      setEditingFollowUpId(null);
      setShowFollowUpForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save follow-up.");
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  function handleEditFollowUp(followUpId: string) {
    if (!app?.followUps) return;
    const followUp = app.followUps.find((f) => f.id === followUpId);
    if (!followUp) return;
    setFollowUpForm({
      id: followUp.id,
      title: followUp.title,
      description: followUp.description ?? "",
      nextFollowUpAt: toDateTimeLocalValue(followUp.scheduledAt),
    });
    setEditingFollowUpId(followUp.id);
    setShowFollowUpForm(true);
  }

  async function handleDeleteFollowUp(followUpId: string) {
    if (!id) return;
    try {
      setIsSavingFollowUp(true);
      setError(null);
      await jobApplicationsApi.deleteFollowUp(id, followUpId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete follow-up.");
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  function handleToggleFollowUpForm() {
    setFollowUpForm({ id: "", title: "", description: "", nextFollowUpAt: "" });
    setEditingFollowUpId(null);
    setShowFollowUpForm((v) => !v);
  }
```

- [ ] **Step 2: Remove followUpNotes from handleSaveNotes**

Replace `handleSaveNotes`:

```typescript
  async function handleSaveNotes() {
    if (!id || !app) return;
    try {
      setIsSavingNotes(true);
      setError(null);
      await jobApplicationsApi.update(id, {
        metadata: { ...(app.metadata ?? {}), notes: notes.trim() },
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notes.");
    } finally {
      setIsSavingNotes(false);
    }
  }
```

Also update `refresh()` — replace `setNotes(mapped.followUpNotes ?? "")` with:

```typescript
    const notesValue = mapped.metadata?.notes;
    setNotes(typeof notesValue === "string" ? notesValue : "");
```

- [ ] **Step 3: Update the TimelineTab props and rendering**

Update the `TimelineTab` call in the main component (around line 472):

```typescript
      {tab === "timeline" && (
        <TimelineTab
          app={app}
          followUpForm={followUpForm}
          showFollowUpForm={showFollowUpForm}
          isSavingFollowUp={isSavingFollowUp}
          isSavingNotes={isSavingNotes}
          contactForm={contactForm}
          showContactForm={showContactForm}
          isAddingContact={isAddingContact}
          notes={notes}
          onSetFollowUpForm={setFollowUpForm}
          onToggleFollowUpForm={handleToggleFollowUpForm}
          onSaveFollowUp={handleSaveFollowUp}
          onEditFollowUp={handleEditFollowUp}
          onDeleteFollowUp={handleDeleteFollowUp}
          onSetContactForm={setContactForm}
          onToggleContactForm={() => setShowContactForm((v) => !v)}
          onAddContact={handleAddContact}
          onNotesChange={setNotes}
          onSaveNotes={handleSaveNotes}
        />
      )}
```

Update the `TimelineTab` component definition — replace the props type and the follow-up form/list rendering:

```typescript
function TimelineTab({
  app,
  followUpForm,
  showFollowUpForm,
  isSavingFollowUp,
  isSavingNotes,
  contactForm,
  showContactForm,
  isAddingContact,
  notes,
  onSetFollowUpForm,
  onToggleFollowUpForm,
  onSaveFollowUp,
  onEditFollowUp,
  onDeleteFollowUp,
  onSetContactForm,
  onToggleContactForm,
  onAddContact,
  onNotesChange,
  onSaveNotes,
}: {
  app: JobApplication;
  followUpForm: { id: string; title: string; description: string; nextFollowUpAt: string };
  showFollowUpForm: boolean;
  isSavingFollowUp: boolean;
  isSavingNotes: boolean;
  contactForm: { name: string; role: string; email: string };
  showContactForm: boolean;
  isAddingContact: boolean;
  notes: string;
  onSetFollowUpForm: (f: { id: string; title: string; description: string; nextFollowUpAt: string }) => void;
  onToggleFollowUpForm: () => void;
  onSaveFollowUp: (e: React.FormEvent) => void;
  onEditFollowUp: (followUpId: string) => void;
  onDeleteFollowUp: (followUpId: string) => void;
  onSetContactForm: (f: { name: string; role: string; email: string }) => void;
  onToggleContactForm: () => void;
  onAddContact: (e: React.FormEvent) => void;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
}) {
```

Replace the PanelHeader action and the follow-up form section (lines 717-771):

```typescript
        <PanelHeader
          title="Timeline"
          action={
            <Button variant="ghost" size="sm" onClick={onToggleFollowUpForm}>
              + Add follow-up
            </Button>
          }
        />
        {showFollowUpForm && (
          <form onSubmit={onSaveFollowUp} className="space-y-3 border-t border-border px-5 py-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="follow-up-title">
                Title
              </label>
              <input
                id="follow-up-title"
                type="text"
                value={followUpForm.title}
                onChange={(e) => onSetFollowUpForm({ ...followUpForm, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="e.g. Send thank-you email"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="follow-up-description">
                Description (optional)
              </label>
              <textarea
                id="follow-up-description"
                value={followUpForm.description}
                onChange={(e) => onSetFollowUpForm({ ...followUpForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="Add context for this follow-up..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="follow-up-at">
                Follow-up date and time
              </label>
              <input
                id="follow-up-at"
                type="datetime-local"
                value={followUpForm.nextFollowUpAt}
                onChange={(e) => onSetFollowUpForm({ ...followUpForm, nextFollowUpAt: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Link2CV will notify you automatically 10 minutes before this time.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onToggleFollowUpForm}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isSavingFollowUp}>
                {isSavingFollowUp ? "Saving..." : "Save follow-up"}
              </Button>
            </div>
          </form>
        )}
        {app.followUps && app.followUps.length > 0 && (
          <div className="divide-y divide-border border-t border-border">
            {app.followUps.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <CalendarClock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.title}</p>
                  {f.description && (
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(f.scheduledAt).toLocaleString()}
                    {f.reminderSentAt && (
                      <span className="ml-2 inline-flex items-center gap-1 text-success">
                        <Check className="size-3" /> Reminder sent
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditFollowUp(f.id)}
                    disabled={isSavingFollowUp}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteFollowUp(f.id)}
                    disabled={isSavingFollowUp}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
```

Remove the old `{app.nextFollowUpAt && (...)}` block (lines 764-771).

- [ ] **Step 4: Run typecheck to verify the web app compiles**

Run: `pnpm --filter @link2cv/web typecheck`
Expected: PASS — no type errors.

- [ ] **Step 5: Run all tests to verify nothing is broken**

Run: `pnpm test`
Expected: PASS — all tests green.

- [ ] **Step 6: Run the full quality gates**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build`
Expected: PASS — all gates green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/AppDetail.tsx
git commit -m "feat(web): replace single follow-up form with follow-ups list and CRUD UI"
```

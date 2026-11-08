import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Knex } from "knex";
import { afterEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite-knex.js";
import { listPendingPostgresMigrations, runPostgresMigrations } from "./postgres-knex.js";
import { PostgresJobApplicationRepository } from "./job-applications/postgres-job-application.repository.js";
import { PostgresNotificationRepository } from "./notifications/postgres-notification.repository.js";
import { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresPersistenceUnitOfWork } from "./postgres-persistence-unit-of-work.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

const now = new Date("2026-10-29T10:00:00.000Z");

// Runs the production migrations and Postgres repositories against embedded PGlite. Starting the
// WASM database and migrating takes seconds under a parallel test run, hence the longer timeout.
describe("createPgliteDb", { timeout: 30_000 }, () => {
  const databases: Knex[] = [];
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function openDb(dataDir?: string): Promise<Knex> {
    const db = createPgliteDb(dataDir);
    databases.push(db);
    await runPostgresMigrations(db);
    return db;
  }

  async function seedProfile(db: Knex) {
    await db("user").insert({
      id: "local-user",
      name: "Local User",
      email: "local@careerden.local",
    });
    return new PostgresUserProfileRepository(db).createForUserId("local-user", {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [{ company: "Analytical Engines", title: "Engineer" }],
    } as never);
  }

  it("applies every migration and reads back JSON and timestamp columns", async () => {
    const db = await openDb();
    const profile = await seedProfile(db);
    const profiles = new PostgresUserProfileRepository(db);

    await expect(profiles.findByUserId("local-user")).resolves.toMatchObject({
      id: profile.id,
      skills: ["TypeScript"],
      experience: [{ company: "Analytical Engines", title: "Engineer" }],
    });
    expect(profile.createdAt).toBeInstanceOf(Date);
  });

  it("filters, searches, and sorts job applications with jsonb and numeric SQL", async () => {
    const db = await openDb();
    const profile = await seedProfile(db);
    const jobApplications = new PostgresJobApplicationRepository(db);
    const low = await jobApplications.create({
      profileId: profile.id,
      companyName: "Acme",
      roleTitle: "Engineer",
      tags: ["remote", "typescript"],
    });
    const high = await jobApplications.create({
      profileId: profile.id,
      companyName: "Globex",
      roleTitle: "Staff Engineer",
      tags: ["remote"],
    });
    await jobApplications.create({ profileId: profile.id, companyName: "Initech", tags: [] });
    await db("job_applications")
      .where({ id: low.id })
      .update({ match_analysis: { matchScore: 40 } });
    await db("job_applications")
      .where({ id: high.id })
      .update({ match_analysis: { matchScore: 90 } });

    const tagged = await jobApplications.listByProfileId(profile.id, { tag: "remote" });
    const searched = await jobApplications.listByProfileId(profile.id, { search: "globex" });
    const sorted = await jobApplications.listByProfileId(profile.id, {
      tag: "remote",
      sortBy: "matchScore",
      sortDirection: "desc",
    });

    expect(tagged.totalItems).toBe(2);
    expect(searched.items.map((item) => item.id)).toEqual([high.id]);
    expect(sorted.items.map((item) => item.id)).toEqual([high.id, low.id]);
  });

  it("sorts job applications by interest, salary, and added date with nulls last", async () => {
    const db = await openDb();
    const profile = await seedProfile(db);
    const jobApplications = new PostgresJobApplicationRepository(db);
    const high = await jobApplications.create({
      profileId: profile.id,
      priority: "high",
      salaryMinAmount: 50_000,
      dateApplied: "2026-03-01",
    });
    const low = await jobApplications.create({
      profileId: profile.id,
      priority: "low",
      salaryMinAmount: 40_000,
      salaryMaxAmount: 90_000,
      dateApplied: "2026-01-15",
    });
    const unset = await jobApplications.create({ profileId: profile.id });
    const ids = async (sortBy: "priority" | "salary" | "addedAt", sortDirection: "asc" | "desc") =>
      (await jobApplications.listByProfileId(profile.id, { sortBy, sortDirection })).items.map(
        (item) => item.id,
      );

    await expect(ids("priority", "desc")).resolves.toEqual([high.id, low.id, unset.id]);
    await expect(ids("priority", "asc")).resolves.toEqual([low.id, high.id, unset.id]);
    await expect(ids("salary", "desc")).resolves.toEqual([low.id, high.id, unset.id]);
    await expect(ids("salary", "asc")).resolves.toEqual([high.id, low.id, unset.id]);
    await expect(ids("addedAt", "desc")).resolves.toEqual([unset.id, high.id, low.id]);
  });

  it("commits and rolls back unit-of-work transactions", async () => {
    const db = await openDb();
    const profile = await seedProfile(db);
    const unitOfWork = new PostgresPersistenceUnitOfWork(db);

    await unitOfWork.execute(async ({ notifications }) => {
      await notifications.create({ profileId: profile.id, type: "follow_up_reminder", title: "A" });
    });
    await expect(
      unitOfWork.execute(async ({ notifications }) => {
        await notifications.create({
          profileId: profile.id,
          type: "follow_up_reminder",
          title: "B",
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    await expect(
      new PostgresNotificationRepository(db).countUnreadByProfileId(profile.id),
    ).resolves.toBe(1);
  });

  it("serializes concurrent transactions over the single PGlite session", async () => {
    const db = await openDb();
    const profile = await seedProfile(db);
    const unitOfWork = new PostgresPersistenceUnitOfWork(db);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        unitOfWork.execute(async ({ credits, notifications }) => {
          await notifications.create({
            profileId: profile.id,
            type: "follow_up_reminder",
            title: `Reminder ${index}`,
          });
          await credits.ensureGrant({
            userId: "local-user",
            sourceType: "free_monthly",
            idempotencyKey: `grant-${index}`,
            amount: 1,
            validFrom: now,
            createdAt: now,
          });
        }),
      ),
    );

    await expect(
      new PostgresNotificationRepository(db).countUnreadByProfileId(profile.id),
    ).resolves.toBe(5);
    await expect(
      unitOfWork.execute(({ credits }) => credits.getBalance("local-user", now)),
    ).resolves.toMatchObject({ availableCredits: 5 });
  });

  it("claims outbox events with row locking", async () => {
    const db = await openDb();
    const outbox = new PostgresOutboxRepository(db);
    await outbox.add({ type: "storage.delete", payload: { fileId: "file-1" }, availableAt: now });

    const claimed = await outbox.claimPending({
      types: ["storage.delete"],
      leaseOwner: "local",
      leaseDurationMs: 60_000,
      limit: 10,
      now,
    });

    expect(claimed).toHaveLength(1);
    await expect(
      outbox.claimPending({
        types: ["storage.delete"],
        leaseOwner: "local",
        leaseDurationMs: 60_000,
        limit: 10,
        now,
      }),
    ).resolves.toEqual([]);
  });

  it("persists data in a directory across reopen", async () => {
    const directory = await mkdtemp(join(tmpdir(), "careerden-pglite-"));
    directories.push(directory);
    const first = await openDb(directory);
    const profile = await seedProfile(first);
    await first.destroy();
    databases.splice(databases.indexOf(first), 1);

    const second = await openDb(directory);

    await expect(
      new PostgresUserProfileRepository(second).findById(profile.id),
    ).resolves.toMatchObject({ fullName: "Ada Lovelace" });
  });

  it("lists every shipped migration as pending before migrating and none after", async () => {
    const db = createPgliteDb();
    databases.push(db);

    const before = await listPendingPostgresMigrations(db);
    await runPostgresMigrations(db);

    expect(before.length).toBeGreaterThan(0);
    expect(before[0]).toMatch(/^\d{14}_.+\.cjs$/);
    expect([...before].sort()).toEqual(before);
    await expect(listPendingPostgresMigrations(db)).resolves.toEqual([]);
  });

  it("starts new profiles without onboarding and stores its timestamps", async () => {
    const db = await openDb();
    const profiles = new PostgresUserProfileRepository(db);
    const profile = await seedProfile(db);

    expect(profile.onboardingCompletedAt).toBeUndefined();
    expect(profile.onboardingChecklistDismissedAt).toBeUndefined();

    const completed = await profiles.update(profile.id, {
      onboardingCompletedAt: now,
      onboardingChecklistDismissedAt: now,
    });
    expect(completed?.onboardingCompletedAt?.toISOString()).toBe(now.toISOString());
    expect(completed?.onboardingChecklistDismissedAt?.toISOString()).toBe(now.toISOString());

    const restarted = await profiles.update(profile.id, { onboardingCompletedAt: null });
    expect(restarted?.onboardingCompletedAt).toBeUndefined();
    expect(restarted?.onboardingChecklistDismissedAt?.toISOString()).toBe(now.toISOString());
  });
});

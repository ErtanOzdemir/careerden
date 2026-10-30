import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "../persistence/pglite-knex.js";
import { runPostgresMigrations } from "../persistence/postgres-knex.js";
import { PostgresJobApplicationRepository } from "../persistence/job-applications/postgres-job-application.repository.js";
import { PostgresUserProfileRepository } from "../persistence/profiles/postgres-user-profile.repository.js";
import { PostgresFollowUpReminderRepository } from "./follow-up-reminder.repository.js";

const since = new Date("2026-10-22T10:00:00.000Z");

// Runs the reminder queries against real PostgreSQL semantics through embedded PGlite.
describe("PostgresFollowUpReminderRepository.listUndeliveredSince", { timeout: 30_000 }, () => {
  let db: Knex;

  beforeEach(async () => {
    db = createPgliteDb();
    await runPostgresMigrations(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function seed(email: string, remindersEnabled = true) {
    const userId = `user-${email}`;
    await db("user").insert({ id: userId, name: email, email });
    const profile = await new PostgresUserProfileRepository(db).createForUserId(userId, {
      fullName: email,
      email,
      skills: [],
      experience: [],
    } as never);
    if (!remindersEnabled) {
      await db("user_profiles")
        .where({ id: profile.id })
        .update({ follow_up_reminders_enabled: false });
    }
    const jobApplications = new PostgresJobApplicationRepository(db);
    const application = await jobApplications.create({
      profileId: profile.id,
      companyName: "Acme",
    });
    const followUp = (title: string, scheduledAt: Date) =>
      jobApplications.createFollowUp({
        jobApplicationId: application.id,
        profileId: profile.id,
        title,
        scheduledAt,
      });
    return { application, followUp, jobApplications };
  }

  it("returns unsent reminders from the window onward, scheduled or not, oldest first", async () => {
    const { followUp } = await seed("ada@example.com");
    const later = await followUp("Later", new Date("2026-11-05T09:00:00.000Z"));
    const missed = await followUp("Missed", new Date("2026-10-25T09:00:00.000Z"));
    await followUp("Too old", new Date("2026-10-20T09:00:00.000Z"));
    const sent = await followUp("Sent", new Date("2026-10-26T09:00:00.000Z"));
    await db("job_application_follow_ups")
      .where({ id: sent.id })
      .update({ reminder_sent_at: new Date("2026-10-26T08:50:00.000Z") });
    await db("job_application_follow_ups")
      .where({ id: later.id })
      .update({ reminder_job_id: `follow-up-${later.id}` });

    const pending = await new PostgresFollowUpReminderRepository(db).listUndeliveredSince(since);

    expect(pending.map((reminder) => reminder.title)).toEqual(["Missed", "Later"]);
    expect(pending[0]).toMatchObject({ followUpId: missed.id, companyName: "Acme" });
  });

  it("skips archived applications and profiles with reminders turned off", async () => {
    const active = await seed("ada@example.com");
    const archived = await seed("grace@example.com");
    const disabled = await seed("alan@example.com", false);
    const scheduledAt = new Date("2026-11-01T09:00:00.000Z");
    await active.followUp("Active", scheduledAt);
    await archived.followUp("Archived", scheduledAt);
    await disabled.followUp("Disabled", scheduledAt);
    await archived.jobApplications.archive(archived.application.id, since);

    const pending = await new PostgresFollowUpReminderRepository(db).listUndeliveredSince(since);

    expect(pending.map((reminder) => reminder.title)).toEqual(["Active"]);
  });
});

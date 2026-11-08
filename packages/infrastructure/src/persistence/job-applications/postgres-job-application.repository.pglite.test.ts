import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "../pglite-knex.js";
import { runPostgresMigrations } from "../postgres-knex.js";
import { PostgresUserProfileRepository } from "../profiles/postgres-user-profile.repository.js";
import { PostgresJobApplicationRepository } from "./postgres-job-application.repository.js";

// Runs the AI failure columns against real PostgreSQL semantics through embedded PGlite.
describe("PostgresJobApplicationRepository AI failures", { timeout: 30_000 }, () => {
  let db: Knex;

  beforeEach(async () => {
    db = createPgliteDb();
    await runPostgresMigrations(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function analyzingApplication() {
    await db("user").insert({ id: "user-1", name: "Ada", email: "ada@example.com" });
    const profile = await new PostgresUserProfileRepository(db).createForUserId("user-1", {
      fullName: "Ada",
      email: "ada@example.com",
      skills: [],
      experience: [],
    } as never);
    const jobApplications = new PostgresJobApplicationRepository(db);
    const application = await jobApplications.create({ profileId: profile.id });
    await jobApplications.updateStatus(application.id, "scraped");
    await jobApplications.setAnalysisAttempt(application.id, "attempt-1");
    await jobApplications.beginAnalysis(application.id, "attempt-1");
    return { application, jobApplications };
  }

  it("stores the AI failure with the reason and clears it when analysis is retried", async () => {
    const { application, jobApplications } = await analyzingApplication();

    await expect(
      jobApplications.failAnalysis(application.id, "attempt-1", "Your API key is invalid.", {
        category: "invalid_api_key",
        provider: "openai",
        statusCode: 401,
      }),
    ).resolves.toBe(true);

    expect(await jobApplications.findById(application.id)).toMatchObject({
      status: "failed",
      failureReason: "Your API key is invalid.",
      aiFailure: { category: "invalid_api_key", provider: "openai", statusCode: 401 },
    });

    const reset = await jobApplications.resetAnalysis(application.id);
    expect(reset.failureReason).toBeUndefined();
    expect(reset.aiFailure).toBeUndefined();
  });

  it("leaves the AI failure empty for failures outside the AI provider", async () => {
    const { application, jobApplications } = await analyzingApplication();

    await jobApplications.failAnalysis(application.id, "attempt-1", "Profile not found");

    expect((await jobApplications.findById(application.id))?.aiFailure).toBeUndefined();
  });
});

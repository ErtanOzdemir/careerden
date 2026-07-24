import { describe, expect, it, vi } from "vitest";
import type { PersistenceUnitOfWork } from "@careerden/domain";
import {
  InMemoryCreditRepository,
  InMemoryJobApplicationRepository,
} from "@careerden/infrastructure";
import { createProfiles } from "./job-application-test-helpers.js";
import { ExpireStaleCreditReservationsUseCase } from "./expire-stale-credit-reservations.use-case.js";

describe("ExpireStaleCreditReservationsUseCase", () => {
  it("fails an abandoned current attempt and releases its credit", async () => {
    const createdAt = new Date("2026-07-24T00:00:00.000Z");
    const expiresAt = new Date("2026-07-25T00:00:00.000Z");
    const credits = new InMemoryCreditRepository();
    await credits.ensureGrant({
      userId: "user-1",
      sourceType: "free_monthly",
      idempotencyKey: "free:user-1:2026-07",
      amount: 1,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt,
    });
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    await jobApplications.updateStatus(jobApplication.id, "scraped");
    await jobApplications.setAnalysisAttempt(jobApplication.id, "attempt-1");
    await credits.reserve({
      id: "attempt-1",
      userId: "user-1",
      operationType: "match_analysis",
      resourceType: "job_application",
      resourceId: jobApplication.id,
      amount: 1,
      expiresAt,
      createdAt,
    });
    const unitOfWork: PersistenceUnitOfWork = {
      execute: (work) =>
        work({
          billingSubscriptions: {} as never,
          credits,
          jobApplications,
          jobApplicationChanges: { changed: vi.fn(), deleted: vi.fn() },
          profiles: createProfiles() as never,
          notifications: {} as never,
          notificationChanges: {} as never,
          followUpReminders: {} as never,
          outbox: {} as never,
        }),
    };

    await expect(
      new ExpireStaleCreditReservationsUseCase(unitOfWork, () => expiresAt).execute(),
    ).resolves.toBe(1);

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("failed");
    expect(await credits.findReservation("attempt-1")).toMatchObject({
      status: "released",
      releaseReason: "timeout",
    });
    await expect(credits.getBalance("user-1", expiresAt)).resolves.toEqual({
      totalCredits: 1,
      availableCredits: 1,
      reservedCredits: 0,
    });
  });
});

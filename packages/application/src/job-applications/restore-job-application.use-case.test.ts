import { describe, expect, it } from "vitest";
import { InMemoryJobApplicationRepository } from "@careerden/infrastructure";
import { ArchiveJobApplicationUseCase } from "./archive-job-application.use-case.js";
import { RestoreJobApplicationUseCase } from "./restore-job-application.use-case.js";
import { createUnitOfWork } from "./job-application-test-helpers.js";

describe("RestoreJobApplicationUseCase", () => {
  it("restores an application and reschedules only future unsent follow-ups", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: job.profileId,
      title: "Future follow-up",
      scheduledAt: new Date("2026-08-02T12:00:00.000Z"),
    });
    await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: job.profileId,
      title: "Past follow-up",
      scheduledAt: new Date("2026-07-30T12:00:00.000Z"),
    });
    const setup = createUnitOfWork(repository);
    await new ArchiveJobApplicationUseCase(
      setup.unitOfWork,
      () => new Date("2026-07-31T10:00:00.000Z"),
    ).execute(job.id, "user-1");

    const restored = await new RestoreJobApplicationUseCase(
      setup.unitOfWork,
      () => new Date("2026-07-31T12:00:00.000Z"),
    ).execute(job.id, "user-1");

    expect(restored.archivedAt).toBeUndefined();
    expect(setup.addOutboxEvent).toHaveBeenCalledTimes(1);
    expect(setup.addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "follow-up-reminder.schedule",
        payload: expect.objectContaining({ followUpAt: "2026-08-02T12:00:00.000Z" }),
      }),
    );
    expect(setup.recordChanged).toHaveBeenLastCalledWith(job.id, job.profileId);
  });
});

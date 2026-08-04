import { describe, expect, it } from "vitest";
import { InMemoryJobApplicationRepository } from "@careerden/infrastructure";
import { ArchiveJobApplicationUseCase } from "./archive-job-application.use-case.js";
import { createProfiles, createUnitOfWork } from "./job-application-test-helpers.js";

describe("ArchiveJobApplicationUseCase", () => {
  it("archives a stable owned application and records the change", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    const archivedAt = new Date("2026-07-31T12:00:00.000Z");
    const { unitOfWork, recordChanged } = createUnitOfWork(repository);

    const archived = await new ArchiveJobApplicationUseCase(unitOfWork, () => archivedAt).execute(
      job.id,
      "user-1",
    );

    expect(archived.archivedAt).toEqual(archivedAt);
    await expect(repository.listByProfileId("profile-1")).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
    await expect(
      repository.listByProfileId("profile-1", { archiveState: "archived" }),
    ).resolves.toMatchObject({ items: [{ id: job.id }], totalItems: 1 });
    await expect(repository.listEvents(job.id)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Application archived" })]),
    );
    expect(recordChanged).toHaveBeenCalledWith(job.id, job.profileId);
  });

  it("rejects queued work and inaccessible applications", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const queued = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());
    const useCase = new ArchiveJobApplicationUseCase(unitOfWork);

    await expect(useCase.execute(queued.id, "user-1")).rejects.toMatchObject({ code: "conflict" });
    await expect(useCase.execute(queued.id, "user-2")).rejects.toMatchObject({ code: "not_found" });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { UserProfileAccountRepository } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { DeleteJobApplicationUseCase } from "./delete-job-application.use-case.js";
import { createUnitOfWork } from "./job-application-test-helpers.js";

describe("DeleteJobApplicationUseCase", () => {
  it("deletes the application and its stored files", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());
    const useCase = new DeleteJobApplicationUseCase(unitOfWork);

    await expect(useCase.execute(job.id, "user-1")).resolves.toBeUndefined();

    expect(await repository.findById(job.id)).toBeNull();
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete", payload: { fileId: "files/cv.pdf" } }),
    );
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job-application.change",
        payload: expect.objectContaining({ type: "application.deleted", applicationId: job.id }),
      }),
    );
  });

  it("reports a missing application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());
    const useCase = new DeleteJobApplicationUseCase(unitOfWork);

    await expect(useCase.execute("missing-job", "user-1")).rejects.toMatchObject({
      code: "not_found",
    });

    expect(addOutboxEvent).not.toHaveBeenCalled();
  });
});

function createProfiles(): UserProfileAccountRepository {
  return { findUserIdByProfileId: vi.fn(async () => "user-1") } as UserProfileAccountRepository;
}

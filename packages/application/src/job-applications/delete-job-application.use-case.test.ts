import { describe, expect, it, vi } from "vitest";
import type { FileStorage, UserProfileAccountRepository } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { DeleteJobApplicationUseCase } from "./delete-job-application.use-case.js";

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
    const storage = createStorage();
    const useCase = new DeleteJobApplicationUseCase(repository, createProfiles(), storage);

    await expect(useCase.execute(job.id, "user-1")).resolves.toBeUndefined();

    expect(await repository.findById(job.id)).toBeNull();
    expect(storage.delete).toHaveBeenCalledWith("files/cv.pdf");
  });

  it("reports a missing application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const storage = createStorage();
    const useCase = new DeleteJobApplicationUseCase(repository, createProfiles(), storage);

    await expect(useCase.execute("missing-job", "user-1")).rejects.toMatchObject({
      code: "not_found",
    });

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("keeps the application deleted when file cleanup fails", async () => {
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
    const storage = createStorage();
    vi.mocked(storage.delete).mockRejectedValue(new Error("Storage unavailable"));
    const useCase = new DeleteJobApplicationUseCase(repository, createProfiles(), storage);

    await expect(useCase.execute(job.id, "user-1")).resolves.toBeUndefined();
    expect(await repository.findById(job.id)).toBeNull();
  });
});

function createStorage(): FileStorage {
  return {
    put: vi.fn(),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  } as FileStorage;
}

function createProfiles(): UserProfileAccountRepository {
  return { findUserIdByProfileId: vi.fn(async () => "user-1") } as UserProfileAccountRepository;
}

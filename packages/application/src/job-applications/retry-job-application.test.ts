import { describe, expect, it, vi } from "vitest";
import type { FileStorage } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { RetryJobApplicationUseCase } from "./retry-job-application.js";

describe("RetryJobApplicationUseCase", () => {
  it("clears failed processing data and returns the job to the desktop scraping queue", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    await repository.updateStatus(job.id, "failed", "Scraping failed");
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const storage = createStorage();
    const useCase = new RetryJobApplicationUseCase(repository, storage);

    const retried = await useCase.execute(job.id);

    expect(retried?.status).toBe("queued");
    expect(retried?.failureReason).toBeUndefined();
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
    expect(await repository.getScrapeBundle(job.id)).toBeNull();
    expect(storage.delete).toHaveBeenCalledWith("files/cv.pdf");
    expect((await repository.listEvents(job.id))[0]?.title).toBe("Retry requested");
  });

  it("rejects retrying a job that is not failed", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const useCase = new RetryJobApplicationUseCase(repository, createStorage());

    await expect(useCase.execute(job.id)).rejects.toThrow(
      "Only failed job applications can be retried",
    );
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

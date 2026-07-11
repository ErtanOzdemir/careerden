import { describe, expect, it, vi } from "vitest";
import type {
  FileStorage,
  JobApplicationQueue,
  ScrapeBundle,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { RetryJobApplicationUseCase } from "./retry-job-application.use-case.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

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
    const publish = vi.fn();
    const useCase = new RetryJobApplicationUseCase(
      repository,
      createProfiles(),
      storage,
      createQueue(),
      new JobApplicationChangeNotifier({ publish }),
    );

    const retried = await useCase.execute(job.id, "user-1");

    expect(retried?.mode).toBe("scraping");
    expect(retried?.jobApplication.status).toBe("queued");
    expect(retried?.jobApplication.failureReason).toBeUndefined();
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
    expect(await repository.getScrapeBundle(job.id)).toBeNull();
    expect(storage.delete).toHaveBeenCalledWith("files/cv.pdf");
    expect((await repository.listEvents(job.id))[0]?.title).toBe("Retry requested");
    expect(publish).toHaveBeenCalledOnce();
  });

  it("preserves scraped data and restarts AI analysis when retrying an AI failure", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const scrape = createScrapeBundle();
    await repository.saveScrapeBundle(job.id, scrape);
    await repository.updateStatus(job.id, "failed", "OpenAI request failed");
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const storage = createStorage();
    const queue = createQueue();
    const useCase = new RetryJobApplicationUseCase(
      repository,
      createProfiles(),
      storage,
      queue,
      new JobApplicationChangeNotifier({ publish: vi.fn() }),
    );

    const retried = await useCase.execute(job.id, "user-1");

    expect(retried?.mode).toBe("analysis");
    expect(retried?.jobApplication.status).toBe("scraped");
    expect(retried?.jobApplication.failureReason).toBeUndefined();
    expect(await repository.getScrapeBundle(job.id)).toEqual(scrape);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
    expect(storage.delete).toHaveBeenCalledWith("files/cv.pdf");
    expect(queue.restart).toHaveBeenCalledWith({ jobApplicationId: job.id });
  });

  it("rejects retrying a job that is not failed", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const useCase = new RetryJobApplicationUseCase(
      repository,
      createProfiles(),
      createStorage(),
      createQueue(),
      new JobApplicationChangeNotifier({ publish: vi.fn() }),
    );

    await expect(useCase.execute(job.id, "user-1")).rejects.toThrow(
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

function createProfiles(): UserProfileAccountRepository {
  return { findUserIdByProfileId: vi.fn(async () => "user-1") } as UserProfileAccountRepository;
}

function createQueue(): JobApplicationQueue {
  return { enqueue: vi.fn(), restart: vi.fn() };
}

function createScrapeBundle(): ScrapeBundle {
  return {
    job: {
      title: "Backend Engineer",
      companyName: "Example Inc",
      description: "Build TypeScript services",
      requirements: ["TypeScript"],
      raw: {},
    },
  };
}

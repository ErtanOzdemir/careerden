import { describe, expect, it, vi } from "vitest";
import {
  documentContentFromMatchAnalysis,
  type ScrapeBundle,
  type UserProfileAccountRepository,
} from "@careerden/domain";
import { InMemoryJobApplicationRepository } from "@careerden/infrastructure";
import { RetryJobApplicationUseCase } from "./retry-job-application.use-case.js";
import { createUnitOfWork } from "./job-application-test-helpers.js";

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
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(
      repository,
      createProfiles(),
    );
    const useCase = new RetryJobApplicationUseCase(unitOfWork);

    const retried = await useCase.execute(job.id, "user-1");

    expect(retried?.mode).toBe("scraping");
    expect(retried?.jobApplication.status).toBe("queued");
    expect(retried?.jobApplication.failureReason).toBeUndefined();
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
    expect(await repository.getScrapeBundle(job.id)).toBeNull();
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete", payload: { fileId: "files/cv.pdf" } }),
    );
    expect((await repository.listEvents(job.id))[0]?.title).toBe("Retry requested");
    expect(recordChanged).toHaveBeenCalledOnce();
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
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());
    const useCase = new RetryJobApplicationUseCase(unitOfWork);

    const retried = await useCase.execute(job.id, "user-1");

    expect(retried?.mode).toBe("analysis");
    expect(retried?.jobApplication.status).toBe("scraped");
    expect(retried?.jobApplication.failureReason).toBeUndefined();
    expect(await repository.getScrapeBundle(job.id)).toEqual(scrape);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete", payload: { fileId: "files/cv.pdf" } }),
    );
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.analysis-requested" }),
    );
  });

  it("preserves completed analysis and retries only application pack generation", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
      applicationPackPreferences: { language: "tr-TR", tone: "concise" },
    });
    const scrape = createScrapeBundle();
    const analysis = createMatchAnalysis();
    const documentContent = documentContentFromMatchAnalysis(
      { education: [], experience: [], projects: [] },
      analysis,
    );
    await repository.saveScrapeBundle(job.id, scrape);
    await repository.saveMatchAnalysis(job.id, analysis);
    await repository.saveDocumentContent(job.id, documentContent);
    await repository.updateStatus(job.id, "review_ready");
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/existing-cv.pdf",
      fileName: "existing-cv.pdf",
      contentType: "application/pdf",
    });
    await repository.beginDocumentGeneration(job.id, "failed-attempt");
    await repository.failDocumentGeneration(job.id, "failed-attempt", "PDF rendering failed");
    const existingDocuments = await repository.listGeneratedDocuments(job.id);
    const { unitOfWork, addOutboxEvent, credits, recordChanged } = createUnitOfWork(
      repository,
      createProfiles(),
    );
    const useCase = new RetryJobApplicationUseCase(unitOfWork);

    const retried = await useCase.execute(job.id, "user-1");

    expect(retried.mode).toBe("documents");
    expect(retried.jobApplication).toMatchObject({
      status: "generating_documents",
      failureReason: undefined,
      documentGenerationAttemptId: expect.any(String),
      applicationPackPreferences: { language: "tr-TR", tone: "concise" },
    });
    expect(retried.jobApplication.documentGenerationAttemptId).not.toBe("failed-attempt");
    expect(await repository.getScrapeBundle(job.id)).toEqual(scrape);
    expect(await repository.getMatchAnalysis(job.id)).toEqual(analysis);
    expect(await repository.getDocumentContent(job.id)).toEqual(documentContent);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual(existingDocuments);
    expect(addOutboxEvent).toHaveBeenCalledWith({
      type: "application-pack.generation-requested",
      aggregateId: job.id,
      payload: {
        jobApplicationId: job.id,
        generationAttemptId: retried.jobApplication.documentGenerationAttemptId,
      },
    });
    expect(addOutboxEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.analysis-requested" }),
    );
    expect(addOutboxEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete" }),
    );
    expect(credits.releaseReservationsForResource).not.toHaveBeenCalled();
    expect(recordChanged).toHaveBeenCalledWith(job.id, job.profileId);
  });

  it("rejects retrying a job that is not failed", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const { unitOfWork } = createUnitOfWork(repository, createProfiles());
    const useCase = new RetryJobApplicationUseCase(unitOfWork);

    await expect(useCase.execute(job.id, "user-1")).rejects.toThrow(
      "Only failed job applications can be retried",
    );
  });
});

function createProfiles(): UserProfileAccountRepository {
  return {
    findUserIdByProfileId: vi.fn(async () => "user-1"),
    findById: vi.fn(async () => ({
      id: "profile-1",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      autoRunMatchAnalysis: true,
      autoGenerateDocuments: true,
      followUpRemindersEnabled: true,
      profession: "Software Engineer",
      links: [],
      skills: ["TypeScript"],
      experience: [],
      education: [],
      certifications: [],
      projects: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  } as UserProfileAccountRepository;
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

function createMatchAnalysis() {
  return {
    matchScore: 90,
    missingSkills: [],
    strongSkills: ["TypeScript"],
    recommendedAchievements: [],
    customizedSummary: "Summary",
    interviewTips: [],
  };
}

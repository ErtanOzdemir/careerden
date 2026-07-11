import { describe, expect, it, vi } from "vitest";
import type {
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationEvent,
  JobApplicationQueue,
  JobApplicationRepository,
} from "@link2cv/domain";
import {
  claimNextScrapeJob,
  enqueueMatchAnalysisIfEnabled,
  failScrapeJob,
  getGeneratedDocumentDownloadUrl,
  renewScrapeClaim,
} from "./job-applications.routes.js";

describe("job applications route behavior", () => {
  it("returns a signed URL for the selected document", async () => {
    const document = createGeneratedDocument({
      id: "doc-1",
      jobApplicationId: "job-1",
      fileId: "object-key/cv.pdf",
    });
    const jobApplications = createJobApplicationRepository({
      listGeneratedDocuments: vi.fn(async () => [document]),
    });
    const storage = createFileStorage({
      getSignedUrl: vi.fn(async () => "http://localhost:9000/link2cv-files/signed"),
    });

    const url = await getGeneratedDocumentDownloadUrl({
      jobApplications,
      storage,
      jobApplicationId: "job-1",
      documentId: "doc-1",
    });

    expect(jobApplications.listGeneratedDocuments).toHaveBeenCalledWith("job-1");
    expect(storage.getSignedUrl).toHaveBeenCalledWith("object-key/cv.pdf");
    expect(url).toBe("http://localhost:9000/link2cv-files/signed");
  });

  it("returns undefined when the selected document does not exist", async () => {
    const jobApplications = createJobApplicationRepository({
      listGeneratedDocuments: vi.fn(async () => []),
    });
    const storage = createFileStorage({
      getSignedUrl: vi.fn(),
    });

    const url = await getGeneratedDocumentDownloadUrl({
      jobApplications,
      storage,
      jobApplicationId: "job-1",
      documentId: "doc-1",
    });

    expect(url).toBeUndefined();
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });

  it("enqueues match analysis when the profile preference is enabled", async () => {
    const queue = createJobApplicationQueue();
    const jobApplications = createJobApplicationRepository();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        jobApplications,
        queue,
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
      }),
    ).resolves.toBe(true);

    expect(queue.enqueue).toHaveBeenCalledWith({ jobApplicationId: "job-1" });
    expect(jobApplications.addEvent).not.toHaveBeenCalled();
  });

  it("leaves scraped jobs ready for manual analysis when the profile preference is disabled", async () => {
    const queue = createJobApplicationQueue();
    const jobApplications = createJobApplicationRepository({
      addEvent: vi.fn(async () => createEvent({ jobApplicationId: "job-1" })),
    });

    await expect(
      enqueueMatchAnalysisIfEnabled({
        jobApplications,
        queue,
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: false,
      }),
    ).resolves.toBe(false);

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(jobApplications.addEvent).toHaveBeenCalledWith({
      jobApplicationId: "job-1",
      type: "processing",
      title: "AI analysis skipped",
      body: "Auto-run match analysis is disabled for this profile.",
    });
  });

  it("claims a queued scrape job through the desktop worker endpoint", async () => {
    const job = createJobApplication({ status: "scraping" });
    const jobApplications = createJobApplicationRepository({
      claimNextScrapeJob: vi.fn(async () => job),
    });

    const claimed = await claimNextScrapeJob(jobApplications, {
      profileId: "profile-1",
      claimedBy: "desktop-a",
    });

    expect(claimed).toEqual(job);
    expect(jobApplications.claimNextScrapeJob).toHaveBeenCalledWith({
      profileId: "profile-1",
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
    });
  });

  it("renews a scrape claim through the desktop worker heartbeat endpoint", async () => {
    const job = createJobApplication({ status: "scraping", scrapeClaimedBy: "desktop-a" });
    const jobApplications = createJobApplicationRepository({
      renewScrapeClaim: vi.fn(async () => job),
    });

    await expect(
      renewScrapeClaim(jobApplications, job.id, { claimedBy: "desktop-a" }),
    ).resolves.toEqual(job);

    expect(jobApplications.renewScrapeClaim).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
    });
  });

  it("schedules a retry for a claimed scrape job failure before max attempts", async () => {
    const job = createJobApplication({
      id: "job-1",
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 1,
    });
    const retryScheduled = createJobApplication({
      ...job,
      status: "queued",
      failureReason: "LinkedIn session expired",
      scrapeAttemptCount: 1,
      nextScrapeAttemptAt: new Date("2026-06-30T10:01:00.000Z"),
    });
    const jobApplications = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => retryScheduled),
      addEvent: vi.fn(async () => createEvent({ jobApplicationId: job.id, title: "failed" })),
    });

    const result = await failScrapeJob(
      jobApplications,
      job.id,
      {
        claimedBy: "desktop-a",
        reason: "LinkedIn session expired",
      },
      new Date("2026-06-30T10:00:00.000Z"),
    );

    expect(result).toBe("retry_scheduled");
    expect(jobApplications.recordScrapeFailure).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      reason: "LinkedIn session expired",
      maxAttempts: 3,
      backoffMs: 60_000,
      now: new Date("2026-06-30T10:00:00.000Z"),
    });
    expect(jobApplications.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "Scraping retry scheduled",
      body: "LinkedIn session expired",
      metadata: { attempt: 1, maxAttempts: 3, nextAttemptAt: "2026-06-30T10:01:00.000Z" },
    });
  });

  it("marks a claimed scrape job failed on the final scrape attempt", async () => {
    const job = createJobApplication({
      id: "job-1",
      status: "scraping",
      scrapeClaimedBy: "desktop-a",
      scrapeAttemptCount: 3,
    });
    const failed = createJobApplication({
      ...job,
      status: "failed",
      failureReason: "LinkedIn selector changed",
    });
    const jobApplications = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      recordScrapeFailure: vi.fn(async () => failed),
      addEvent: vi.fn(async () => createEvent({ jobApplicationId: job.id, title: "failed" })),
    });

    await expect(
      failScrapeJob(jobApplications, job.id, {
        claimedBy: "desktop-a",
        reason: "LinkedIn selector changed",
      }),
    ).resolves.toBe("failed");

    expect(jobApplications.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "Scraping failed",
      body: "LinkedIn selector changed",
      metadata: { attempt: 3, maxAttempts: 3 },
    });
  });
});

function createJobApplicationRepository(
  overrides: Partial<JobApplicationRepository> = {},
): JobApplicationRepository {
  return {
    create: vi.fn(),
    claimNextScrapeJob: vi.fn(async () => null),
    deleteById: vi.fn(),
    findById: vi.fn(),
    listByProfileId: vi.fn(async () => []),
    listByStatus: vi.fn(async () => []),
    resetProcessing: vi.fn(),
    resetAnalysis: vi.fn(),
    renewScrapeClaim: vi.fn(async () => null),
    recordScrapeFailure: vi.fn(async () => null),
    updateStatus: vi.fn(),
    updateTracking: vi.fn(),
    saveScrapeBundle: vi.fn(),
    getScrapeBundle: vi.fn(),
    getCompanyLogoFileId: vi.fn(async () => null),
    saveMatchAnalysis: vi.fn(),
    getMatchAnalysis: vi.fn(),
    saveDocumentContent: vi.fn(),
    getDocumentContent: vi.fn(async () => null),
    addEvent: vi.fn(),
    listEvents: vi.fn(async () => []),
    createContact: vi.fn(),
    findContactById: vi.fn(),
    listContacts: vi.fn(async () => []),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    listFollowUps: vi.fn(async () => []),
    createFollowUp: vi.fn(),
    findFollowUpById: vi.fn(),
    updateFollowUp: vi.fn(),
    deleteFollowUp: vi.fn(),
    attachGeneratedDocument: vi.fn(),
    listGeneratedDocuments: vi.fn(async () => []),
    ...overrides,
  } as JobApplicationRepository;
}

function createJobApplicationQueue(): JobApplicationQueue {
  return {
    enqueue: vi.fn(),
    restart: vi.fn(),
  };
}

function createFileStorage(overrides: Partial<FileStorage> = {}): FileStorage {
  return {
    put: vi.fn(),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as FileStorage;
}

function createJobApplication(overrides: Partial<JobApplication> = {}): JobApplication {
  const now = new Date("2026-06-14T00:00:00.000Z");

  return {
    id: "job-1",
    profileId: "profile-1",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    status: "completed",
    scrapeAttemptCount: 0,
    tracking: createTracking(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTracking(
  overrides: Partial<JobApplication["tracking"]> = {},
): JobApplication["tracking"] {
  return {
    applicationStatus: "applied",
    priority: "medium",
    tags: [],
    metadata: {},
    ...overrides,
  };
}

function createGeneratedDocument(overrides: Partial<GeneratedDocument> = {}): GeneratedDocument {
  return {
    id: "doc-1",
    jobApplicationId: "job-1",
    kind: "cv",
    format: "pdf",
    fileId: "object-key/cv.pdf",
    fileName: "cv.pdf",
    contentType: "application/pdf",
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    ...overrides,
  };
}

function createEvent(overrides: Partial<JobApplicationEvent> = {}): JobApplicationEvent {
  return {
    id: "event-1",
    jobApplicationId: "job-1",
    type: "reminder",
    title: "Event",
    occurredAt: new Date("2026-06-20T09:00:00.000Z"),
    metadata: {},
    createdAt: new Date("2026-06-20T09:00:00.000Z"),
    ...overrides,
  };
}

import { describe, expect, it, vi } from "vitest";
import type {
  DocumentContent,
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  JobApplicationQueue,
  JobApplicationRepository,
} from "@link2cv/domain";
import {
  calculateJobApplicationAnalytics,
  claimNextScrapeJob,
  enqueueMatchAnalysisIfEnabled,
  failScrapeJob,
  getGeneratedDocumentDownloadUrl,
  getJobApplicationDetail,
  listJobApplicationsWithDocuments,
  renewScrapeClaim,
  requestJobApplicationAnalysis,
  retryFailedJobApplication,
} from "./job-applications.routes.js";

describe("job applications route behavior", () => {
  it("includes generated documents in the job list response", async () => {
    const job = createJobApplication({ id: "job-1" });
    const document = createGeneratedDocument({
      id: "doc-1",
      jobApplicationId: job.id,
      kind: "cv",
      fileId: "object-key/cv.pdf",
      fileName: "cv.pdf",
    });
    const jobApplications = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => [job]),
      getCompanyLogoFileId: vi.fn(async () => "logos/acme.png"),
      getMatchAnalysis: vi.fn(async () => ({
        matchScore: 82,
        missingSkills: [],
        strongSkills: [],
        recommendedAchievements: [],
        customizedSummary: "",
        interviewTips: [],
      })),
      listGeneratedDocuments: vi.fn(async (jobApplicationId: string) =>
        jobApplicationId === job.id ? [document] : [],
      ),
    });

    const storage = createFileStorage({
      getSignedUrl: vi.fn(async () => "http://localhost:9000/signed-logo"),
    });
    const result = await listJobApplicationsWithDocuments(jobApplications, storage, "profile-1");

    expect(jobApplications.listByProfileId).toHaveBeenCalledWith("profile-1", {});
    expect(jobApplications.listGeneratedDocuments).toHaveBeenCalledWith("job-1");
    expect(storage.getSignedUrl).toHaveBeenCalledWith("logos/acme.png");
    expect(result).toEqual([
      {
        ...job,
        companyLogoUrl: "http://localhost:9000/signed-logo",
        documents: [document],
        matchScore: 82,
      },
    ]);
  });

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

  it("restarts the LLM queue when retrying a failed job from saved scrape data", async () => {
    const job = createJobApplication({ id: "job-1", status: "scraped" });
    const retryJobApplication = {
      execute: vi.fn(async () => ({ jobApplication: job, mode: "analysis" as const })),
    };
    const queue = createJobApplicationQueue();

    const retried = await retryFailedJobApplication({
      retryJobApplication,
      queue,
      jobApplicationId: job.id,
    });

    expect(retried).toBe(job);
    expect(queue.restart).toHaveBeenCalledWith({ jobApplicationId: job.id });
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

  it("queues manual analysis for a scraped job", async () => {
    const job = createJobApplication({ id: "job-1", status: "scraped" });
    const queue = createJobApplicationQueue();
    const jobApplications = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      getScrapeBundle: vi.fn(async () => ({
        job: {
          title: "Engineer",
          companyName: "Acme",
          description: "Build software",
          requirements: [],
          raw: {},
        },
      })),
      addEvent: vi.fn(async () => createEvent({ jobApplicationId: job.id })),
    });

    await expect(
      requestJobApplicationAnalysis({
        jobApplications,
        queue,
        jobApplicationId: job.id,
      }),
    ).resolves.toBe(job);

    expect(queue.enqueue).toHaveBeenCalledWith({ jobApplicationId: job.id });
    expect(jobApplications.addEvent).toHaveBeenCalledWith({
      jobApplicationId: job.id,
      type: "processing",
      title: "AI analysis requested",
    });
  });

  it("does not restart the LLM queue when forcing a scraping retry", async () => {
    const job = createJobApplication({ id: "job-1", status: "queued" });
    const retryJobApplication = {
      execute: vi.fn(async () => ({ jobApplication: job, mode: "scraping" as const })),
    };
    const queue = createJobApplicationQueue();

    const retried = await retryFailedJobApplication({
      retryJobApplication,
      queue,
      jobApplicationId: job.id,
      retryOptions: { mode: "scraping" },
    });

    expect(retried).toBe(job);
    expect(retryJobApplication.execute).toHaveBeenCalledWith(job.id, { mode: "scraping" });
    expect(queue.restart).not.toHaveBeenCalled();
  });

  it("calculates tracker analytics from application status and response dates", () => {
    const jobs = [
      createJobApplication({
        id: "job-1",
        tracking: createTracking({
          applicationStatus: "interview",
          dateApplied: "2026-06-01",
          lastResponseAt: new Date("2026-06-04T00:00:00.000Z"),
        }),
      }),
      createJobApplication({
        id: "job-2",
        tracking: createTracking({ applicationStatus: "rejected", dateApplied: "2026-06-02" }),
      }),
      createJobApplication({
        id: "job-3",
        tracking: createTracking({ applicationStatus: "applied", dateApplied: "2026-06-02" }),
      }),
    ];

    const result = calculateJobApplicationAnalytics(jobs);

    expect(result.byStatus).toEqual({ applied: 1, interview: 1, rejected: 1 });
    expect(result.responseRate).toBe(2 / 3);
    expect(result.interviewConversionRate).toBe(1 / 3);
    expect(result.applicationsOverTime).toEqual({ "2026-06-01": 1, "2026-06-02": 2 });
    expect(result.averageTimeToResponseDays).toBe(3);
  });

  it("includes contacts and interviews in the detail response", async () => {
    const job = createJobApplication({ id: "job-1" });
    const contact = createContact({ jobApplicationId: job.id });
    const interview = createInterview({ jobApplicationId: job.id });
    const event = createEvent({ jobApplicationId: job.id, title: "Interview scheduled" });
    const jobApplications = createJobApplicationRepository({
      getDocumentContent: vi.fn(
        async () =>
          ({
            customizedSummary: {
              version: 1,
              blocks: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Editable summary" }],
                },
              ],
            },
            experienceEnhancements: [],
          }) satisfies DocumentContent,
      ),
      listContacts: vi.fn(async () => [contact]),
      listInterviews: vi.fn(async () => [interview]),
      listEvents: vi.fn(async () => [event]),
      listGeneratedDocuments: vi.fn(async () => []),
      getScrapeBundle: vi.fn(async () => ({
        job: {
          title: "Engineer",
          companyName: "Acme",
          description: "Build software",
          requirements: [],
          raw: {},
        },
        companyLinkedIn: {
          name: "Acme",
          logoFileId: "logos/acme.png",
          logoUrl: "https://media.licdn.com/acme.png",
          raw: {},
        },
      })),
      getMatchAnalysis: vi.fn(async () => null),
      getCompanyLogoFileId: vi.fn(async () => "logos/acme.png"),
    });
    const storage = createFileStorage({
      getSignedUrl: vi.fn(async () => "http://localhost:9000/signed-logo"),
    });

    const detail = await getJobApplicationDetail({
      jobApplications,
      storage,
      jobApplication: job,
    });

    expect(detail.contacts).toEqual([contact]);
    expect(detail.interviews).toEqual([interview]);
    expect(detail.events).toEqual([event]);
    expect(detail.companyLogoUrl).toBe("http://localhost:9000/signed-logo");
    expect(detail.scrapeBundle?.companyLinkedIn).toEqual({ name: "Acme", raw: {} });
    expect(detail.documentContent?.customizedSummary.blocks).toHaveLength(1);
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
    createInterview: vi.fn(),
    findInterviewById: vi.fn(),
    listInterviews: vi.fn(async () => []),
    updateInterview: vi.fn(),
    deleteInterview: vi.fn(),
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
    type: "interview",
    title: "Event",
    occurredAt: new Date("2026-06-20T09:00:00.000Z"),
    metadata: {},
    createdAt: new Date("2026-06-20T09:00:00.000Z"),
    ...overrides,
  };
}

function createContact(overrides: Partial<JobApplicationContact> = {}): JobApplicationContact {
  return {
    id: "contact-1",
    jobApplicationId: "job-1",
    name: "Sarah Hughes",
    role: "Recruitment Lead",
    createdAt: new Date("2026-06-20T09:00:00.000Z"),
    updatedAt: new Date("2026-06-20T09:00:00.000Z"),
    ...overrides,
  };
}

function createInterview(
  overrides: Partial<JobApplicationInterview> = {},
): JobApplicationInterview {
  return {
    id: "interview-1",
    jobApplicationId: "job-1",
    title: "Technical Portfolio Review",
    type: "Technical",
    scheduledAt: new Date("2026-06-24T12:00:00.000Z"),
    status: "upcoming",
    prepNotes: "Review checkout flow redesign",
    createdAt: new Date("2026-06-20T09:00:00.000Z"),
    updatedAt: new Date("2026-06-20T09:00:00.000Z"),
    ...overrides,
  };
}

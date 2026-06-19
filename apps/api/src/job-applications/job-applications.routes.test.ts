import { describe, expect, it, vi } from "vitest";
import type {
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  JobApplicationRepository,
} from "@link2cv/domain";
import {
  calculateJobApplicationAnalytics,
  getGeneratedDocumentDownloadUrl,
  getJobApplicationDetail,
  listJobApplicationsWithDocuments,
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
  });
});

function createJobApplicationRepository(
  overrides: Partial<JobApplicationRepository> = {},
): JobApplicationRepository {
  return {
    create: vi.fn(),
    deleteById: vi.fn(),
    findById: vi.fn(),
    listByProfileId: vi.fn(async () => []),
    listByStatus: vi.fn(async () => []),
    resetProcessing: vi.fn(),
    updateStatus: vi.fn(),
    updateTracking: vi.fn(),
    saveScrapeBundle: vi.fn(),
    getScrapeBundle: vi.fn(),
    getCompanyLogoFileId: vi.fn(async () => null),
    saveMatchAnalysis: vi.fn(),
    getMatchAnalysis: vi.fn(),
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
